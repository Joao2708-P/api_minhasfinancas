import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../database";
import { users, codigoAcesso, membro, cliente } from "../database/schema";
import type { CreateUserInput } from "../schemas";
import type { LoginInput, ResetInput, VerifyCodeInput } from "../schemas/auth.schema";
import { ConflictError, UnauthorizedError } from "../errors/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { generateCode, codeExpiry } from "../lib/accessCode";
import { sendAccessCode, type AccessCodePurpose, type EmailConfig } from "../lib/email";

// Tipo de conta usado pelo front para rotear ao dashboard certo, resolvido no
// login/boot (não por sondagem de endpoints):
//  - 'platform_admin': dono da plataforma (você).
//  - 'owner':          membro ativo de alguma org (contador/investidor e equipe).
//  - 'portal':         cliente com login (vê os próprios dados).
//  - 'none':           sem vínculo — sem acesso.
export type AccountType = "platform_admin" | "owner" | "portal" | "none";

export async function resolveAccountType(
    db: Database,
    user: { id: string; platformAdmin: boolean },
): Promise<AccountType> {
    if (user.platformAdmin) return "platform_admin";

    const m = await db.query.membro.findFirst({
        where: and(eq(membro.user_id, user.id), eq(membro.status, "active")),
    });
    if (m) return "owner";

    const cl = await db.query.cliente.findFirst({
        where: and(eq(cliente.user_id, user.id), eq(cliente.status, "ativo")),
    });
    if (cl) return "portal";

    return "none";
}

// Emite um código de acesso para um usuário: gera, grava o HASH (nunca o valor cru)
// na tabela `codigo_acesso` e "envia" via lib/email. Reusado no primeiro acesso
// (provisionamento) e no "esqueci minha senha". Devolve o código cru só para o
// chamador que precisa dele em dev — nunca é persistido em claro.
export async function issueAccessCode(
    db: Database,
    user: { id: string; email: string },
    purpose: AccessCodePurpose,
    email: EmailConfig,
): Promise<string> {
    const code = generateCode();
    const code_hash = await hashPassword(code);

    await db.insert(codigoAcesso).values({
        user_id: user.id,
        code_hash,
        purpose,
        expiresAt: codeExpiry(),
    });

    await sendAccessCode({ to: user.email, code, purpose }, email);
    return code;
}

// Acha um código utilizável (não usado, não expirado) do usuário que bata com o
// valor informado. NÃO consome — quem consome é o reset (marca usado).
async function findUsableCode(db: Database, userId: string, code: string) {
    const candidates = await db.query.codigoAcesso.findMany({
        where: and(
            eq(codigoAcesso.user_id, userId),
            isNull(codigoAcesso.usedAt),
            gt(codigoAcesso.expiresAt, new Date()),
        ),
    });
    for (const row of candidates) {
        if (await verifyPassword(code, row.code_hash)) return row;
    }
    return undefined;
}

export const authService = {
    async register(db: Database, secret: string, input: CreateUserInput) {
        const duplicateEmail = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });
        if (duplicateEmail) {
            throw new ConflictError("Esse e-mail já está cadastrado em nosso sistema!");
        }

        const duplicateCpf = await db.query.users.findFirst({
            where: eq(users.cpf, input.cpf),
        });
        if (duplicateCpf) {
            throw new ConflictError("Esse CPF já está cadastrado em nosso sistema!");
        }

        const passwordHash = await hashPassword(input.password);

        const [user] = await db
            .insert(users)
            .values({ ...input, password: passwordHash })
            .returning();

        const { password, ...safeUser } = user;
        const token = await signToken(user.id, secret);

        return { user: safeUser, token };
    },

    async login(db: Database, secret: string, input: LoginInput) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        // Mensagem genérica de propósito: não revela se o e-mail existe.
        const invalid = new UnauthorizedError("E-mail ou senha inválidos");

        if (!user) throw invalid;

        const ok = await verifyPassword(input.password, user.password);
        if (!ok) throw invalid;

        const { password, ...safeUser } = user;
        const token = await signToken(user.id, secret);
        const accountType = await resolveAccountType(db, user);

        return { user: { ...safeUser, accountType }, token };
    },

    // "Esqueci minha senha" / primeiro acesso. SEMPRE resolve sem erro: se o e-mail
    // existir, emite um código; se não, não faz nada (não vaza existência).
    // Devolve o código cru para o chamador. O controller SÓ o expõe na resposta
    // quando DEV_EXPOSE_CODES está ligado (homologação sem e-mail real); em produção
    // fica interno (não vaza existência do e-mail nem o código).
    async forgot(db: Database, email: string, emailConfig: EmailConfig): Promise<string | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });
        if (!user) return undefined;

        // Primeiro acesso reusa o mesmo fluxo; o propósito só rotula o e-mail.
        const purpose: AccessCodePurpose = user.mustReset ? "first_access" : "reset";
        return issueAccessCode(db, user, purpose, emailConfig);
    },

    // ETAPA 1 do primeiro acesso / recuperação: valida o código SEM consumi-lo.
    // Serve para o front liberar a tela de "definir nova senha" só após validar.
    async verifyCode(db: Database, input: VerifyCodeInput) {
        const invalid = new UnauthorizedError("Código inválido ou expirado");

        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });
        if (!user) throw invalid;

        const row = await findUsableCode(db, user.id, input.code);
        if (!row) throw invalid;

        return { valid: true as const };
    },

    // ETAPA 2: redefine a senha a partir de um código válido e AUTO-LOGA (token).
    async reset(db: Database, secret: string, input: ResetInput) {
        const invalid = new UnauthorizedError("Código inválido ou expirado");

        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });
        if (!user) throw invalid;

        const matched = await findUsableCode(db, user.id, input.code);
        if (!matched) throw invalid;

        const passwordHash = await hashPassword(input.password);

        // Grava a nova senha, limpa o mustReset e marca o código como usado, atômico.
        await db.batch([
            db
                .update(users)
                .set({ password: passwordHash, mustReset: false, updateAt: new Date() })
                .where(eq(users.id, user.id)),
            db
                .update(codigoAcesso)
                .set({ usedAt: new Date() })
                .where(eq(codigoAcesso.id, matched.id)),
        ]);

        const { password, ...safeUser } = user;
        const token = await signToken(user.id, secret);
        const accountType = await resolveAccountType(db, { ...user, platformAdmin: user.platformAdmin });

        return { user: { ...safeUser, mustReset: false, accountType }, token };
    },
};
