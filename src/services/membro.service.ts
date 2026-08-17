import { and, count, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { membro, papel, users } from "../database/schema";
import type { CreateMembroInput, UpdateMembroInput, InviteMembroInput } from "../schemas";
import type { Role } from "../lib/permissions";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors/errors";
import { hashPassword, generateTempPassword } from "../lib/password";
import { sendInvite, type EmailConfig } from "../lib/email";
import { recordAudit } from "./audit.service";

// Garante que o papel customizado (se informado) é da MESMA org.
async function assertPapelNaOrg(db: Database, orgId: string, papelId: string) {
    const row = await db.query.papel.findFirst({
        where: and(eq(papel.id, papelId), eq(papel.organizacao_id, orgId)),
    });
    if (!row) throw new BadRequestError("Papel inválido (não é desta organização)");
}

export const membroService = {
    // Lista os membros da org com nome/e-mail do usuário.
    async listByOrg(db: Database, orgId: string) {
        return db
            .select({
                id: membro.id,
                role: membro.role,
                papel_id: membro.papel_id,
                status: membro.status,
                user_id: membro.user_id,
                name: users.name,
                email: users.email,
            })
            .from(membro)
            .innerJoin(users, eq(membro.user_id, users.id))
            .where(eq(membro.organizacao_id, orgId));
    },

    // Convida/adiciona um membro à org (a "equipe" do dono). Dois caminhos:
    //  - e-mail JÁ tem conta  → só cria o vínculo (membro). Não pede name/cpf.
    //  - e-mail NOVO          → cria a conta (name+cpf obrigatórios) + o vínculo, num
    //    batch atômico, e envia o convite com a senha (temporária ou informada).
    //    A conta nasce com mustReset=false (default) → a senha devolvida JÁ loga
    //    (mesma escolha do clienteService.createAccess; NÃO usar o fluxo de código aqui).
    // Papel 'owner' não é criável por aqui (schema restringe a admin/planner/viewer).
    async invite(
        db: Database,
        orgId: string,
        input: InviteMembroInput,
        actorUserId: string,
        emailConfig: EmailConfig,
    ) {
        if (input.papel_id) await assertPapelNaOrg(db, orgId, input.papel_id);
        const papel_id = input.papel_id ?? null;

        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        // Caminho 1: usuário já existe → só o vínculo.
        if (existingUser) {
            const existingMembro = await db.query.membro.findFirst({
                where: and(eq(membro.organizacao_id, orgId), eq(membro.user_id, existingUser.id)),
            });
            if (existingMembro && existingMembro.status !== "revoked") {
                throw new ConflictError("Este usuário já é membro desta organização");
            }
            if (existingMembro) {
                // Estava revogado → reativa com o novo papel/permissões.
                const [reactivated] = await db
                    .update(membro)
                    .set({ status: "active", role: input.role, papel_id, updateAt: new Date() })
                    .where(eq(membro.id, existingMembro.id))
                    .returning();
                await recordAudit(db, {
                    organizacao_id: orgId, user_id: actorUserId,
                    action: "atualizado", entity: "membro", entity_id: existingMembro.id,
                    before: existingMembro, after: reactivated,
                });
                return { membro: reactivated, invited: false, email: input.email };
            }

            const [created] = await db
                .insert(membro)
                .values({ organizacao_id: orgId, user_id: existingUser.id, role: input.role, papel_id, status: "active" })
                .returning();
            await recordAudit(db, {
                organizacao_id: orgId, user_id: actorUserId,
                action: "criado", entity: "membro", entity_id: created.id, after: created,
            });
            return { membro: created, invited: false, email: input.email };
        }

        // Caminho 2: e-mail novo → cria a conta (exige name + cpf).
        if (!input.name || !input.cpf) {
            throw new BadRequestError("Nome e CPF são obrigatórios para cadastrar um novo usuário");
        }
        const cpf = input.cpf.replace(/\D/g, "");
        const dupCpf = await db.query.users.findFirst({ where: eq(users.cpf, cpf) });
        if (dupCpf) throw new ConflictError("Esse CPF já está cadastrado em nosso sistema!");

        const password = input.password ?? generateTempPassword();
        const passwordHash = await hashPassword(password);
        const userId = createId();
        const membroId = createId();

        await db.batch([
            db.insert(users).values({ id: userId, name: input.name, email: input.email, cpf, password: passwordHash }),
            db.insert(membro).values({ id: membroId, organizacao_id: orgId, user_id: userId, role: input.role, papel_id, status: "active" }),
        ]);

        await sendInvite({ to: input.email, email: input.email, password }, emailConfig);

        const after = { id: membroId, organizacao_id: orgId, user_id: userId, role: input.role, papel_id, status: "active" };
        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "criado", entity: "membro", entity_id: membroId, after,
        });

        // Devolve a senha p/ repasse (mesmo padrão do acesso de cliente).
        return { membro: after, invited: true, email: input.email, password };
    },

    // Adiciona um usuário existente (por e-mail) como membro da org.
    async addByEmail(db: Database, orgId: string, input: CreateMembroInput, actorUserId: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });
        if (!user) throw new NotFoundError("Usuário");

        const existing = await db.query.membro.findFirst({
            where: and(eq(membro.organizacao_id, orgId), eq(membro.user_id, user.id)),
        });
        if (existing) throw new ConflictError("Usuário já é membro desta organização");

        const [created] = await db
            .insert(membro)
            .values({
                organizacao_id: orgId,
                user_id: user.id,
                role: input.role,
                status: "active",
            })
            .returning();

        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "criado", entity: "membro", entity_id: created.id, after: created,
        });

        return created;
    },

    // Altera papel e/ou revoga acesso. Impede a org de ficar sem owner ativo.
    // `actorRole` = papel-base de quem faz a ação (para blindar o papel de dono).
    async update(
        db: Database,
        orgId: string,
        membroId: string,
        input: UpdateMembroInput,
        actorUserId: string,
        actorRole: Role,
    ) {
        const target = await db.query.membro.findFirst({
            where: and(eq(membro.id, membroId), eq(membro.organizacao_id, orgId)),
        });
        if (!target) throw new NotFoundError("Membro");

        // Blindagem do papel de DONO: só um owner pode conceder o papel de owner ou
        // alterar/revogar um owner existente. Admins (que também têm org:manage_members)
        // não podem se auto-promover a dono nem rebaixar o dono.
        if (actorRole !== "owner") {
            if (input.role === "owner") {
                throw new ForbiddenError("Apenas o dono pode conceder o papel de dono");
            }
            if (target.role === "owner") {
                throw new ForbiddenError("Apenas o dono pode alterar o papel do dono");
            }
        }

        // Atribuir papel customizado: precisa ser um papel da MESMA org (não vaza
        // papel entre tenants). `null` remove o papel (volta ao conjunto fixo do role).
        if (input.papel_id) await assertPapelNaOrg(db, orgId, input.papel_id);

        const removingOwner =
            target.role === "owner" &&
            ((input.role !== undefined && input.role !== "owner") || input.status === "revoked");

        if (removingOwner) {
            const [{ total }] = await db
                .select({ total: count() })
                .from(membro)
                .where(
                    and(
                        eq(membro.organizacao_id, orgId),
                        eq(membro.role, "owner"),
                        eq(membro.status, "active"),
                    ),
                );
            if (Number(total) <= 1) {
                throw new BadRequestError("A organização precisa de ao menos um owner ativo");
            }
        }

        const [updated] = await db
            .update(membro)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(membro.id, membroId), eq(membro.organizacao_id, orgId)))
            .returning();

        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "atualizado", entity: "membro", entity_id: membroId, before: target, after: updated,
        });

        return updated;
    },
};
