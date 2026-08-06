import { and, count, eq } from "drizzle-orm";
import type { Database } from "../database";
import { membro, users } from "../database/schema";
import type { CreateMembroInput, UpdateMembroInput } from "../schemas";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/errors";

export const membroService = {
    // Lista os membros da org com nome/e-mail do usuário.
    async listByOrg(db: Database, orgId: string) {
        return db
            .select({
                id: membro.id,
                role: membro.role,
                status: membro.status,
                user_id: membro.user_id,
                name: users.name,
                email: users.email,
            })
            .from(membro)
            .innerJoin(users, eq(membro.user_id, users.id))
            .where(eq(membro.organizacao_id, orgId));
    },

    // Adiciona um usuário existente (por e-mail) como membro da org.
    async addByEmail(db: Database, orgId: string, input: CreateMembroInput) {
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

        return created;
    },

    // Altera papel e/ou revoga acesso. Impede a org de ficar sem owner ativo.
    async update(db: Database, orgId: string, membroId: string, input: UpdateMembroInput) {
        const target = await db.query.membro.findFirst({
            where: and(eq(membro.id, membroId), eq(membro.organizacao_id, orgId)),
        });
        if (!target) throw new NotFoundError("Membro");

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

        return updated;
    },
};
