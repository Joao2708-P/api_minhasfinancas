import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { users, organizacao, membro } from "../database/schema";
import type { ProvisionOwnerInput, ProvisionPlatformAdminInput } from "../schemas/admin.schema";
import { ConflictError } from "../errors/errors";
import { hashPassword, generateTempPassword } from "../lib/password";
import { sendInvite, type EmailConfig } from "../lib/email";

export const adminService = {
    // Cria o dono (usuário) + a organização + o vínculo owner num batch atômico.
    // É o caminho de provisionamento enquanto o cadastro público está fechado:
    // quem chama é a plataforma (ADMIN_TOKEN), não um usuário logado.
    //
    // A senha já é DEFINIDA aqui: a que você informou, ou uma temporária gerada.
    // O cliente recebe um convite por e-mail com e-mail+senha e entra direto — a
    // resposta também devolve a senha para você poder repassar.
    async provisionOwner(db: Database, input: ProvisionOwnerInput, emailConfig: EmailConfig) {
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

        const password = input.password ?? generateTempPassword();
        const passwordHash = await hashPassword(password);
        const userId = createId();
        const orgId = createId();

        // Ordem importa: usuário → organização (dono_id) → membro (owner).
        // db.batch é atômico no D1 — se qualquer passo falhar, nada é gravado.
        await db.batch([
            db.insert(users).values({
                id: userId,
                name: input.name,
                email: input.email,
                cpf: input.cpf,
                password: passwordHash,
            }),
            db.insert(organizacao).values({
                id: orgId,
                name: input.org_name,
                owner_id: userId,
            }),
            db.insert(membro).values({
                organizacao_id: orgId,
                user_id: userId,
                role: "owner",
                status: "active",
            }),
        ]);

        // "Envia" o convite (fora do batch: envolve e-mail).
        await sendInvite({ to: input.email, email: input.email, password, orgName: input.org_name }, emailConfig);

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const org = await db.query.organizacao.findFirst({ where: eq(organizacao.id, orgId) });

        const safeUser = user ? (({ password: _p, ...rest }) => rest)(user) : null;

        // Devolve a senha para o chamador (você) poder repassar ao cliente.
        return { user: safeUser, org, password };
    },

    // Bootstrap do administrador da plataforma (você): cria o usuário com
    // platform_admin = true. Também com senha (dada ou gerada) + convite.
    // Gated pelo ADMIN_TOKEN — é como o primeiro admin nasce.
    async provisionPlatformAdmin(db: Database, input: ProvisionPlatformAdminInput, emailConfig: EmailConfig) {
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

        const password = input.password ?? generateTempPassword();
        const passwordHash = await hashPassword(password);

        const [user] = await db
            .insert(users)
            .values({
                name: input.name,
                email: input.email,
                cpf: input.cpf,
                password: passwordHash,
                platformAdmin: true,
            })
            .returning();

        await sendInvite({ to: user.email, email: user.email, password }, emailConfig);

        const { password: _p, ...safeUser } = user;
        return { user: safeUser, password };
    },
};
