import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { category } from "../database/schema";
import type { CreateCategoryInput, UpdateCategoryInput } from "../schemas";
import type { Scope } from "../types";
import { recordAudit } from "./audit.service";

const inScope = (s: Scope) =>
    and(eq(category.organizacao_id, s.orgId), eq(category.cliente_id, s.clienteId));

export const CategoryService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.category.findFirst({
            where: and(eq(category.id, id), inScope(s)),
        });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.category.findMany({ where: inScope(s) });
    },

    async create(db: Database, s: Scope, input: CreateCategoryInput, actorUserId: string) {
        const [newCategory] = await db
            .insert(category)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "categoria", entity_id: newCategory.id, after: newCategory,
        });

        return newCategory;
    },

    async update(db: Database, s: Scope, id: string, updateInput: UpdateCategoryInput, actorUserId: string) {
        const before = await this.findByIdOwned(db, s, id);

        const [updated] = await db
            .update(category)
            .set({ ...updateInput, updateAt: new Date() })
            .where(and(eq(category.id, id), inScope(s)))
            .returning();

        if (updated) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "atualizado", entity: "categoria", entity_id: id, before, after: updated,
            });
        }

        return updated;
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db
            .delete(category)
            .where(and(eq(category.id, id), inScope(s)))
            .returning();

        if (deleted) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "excluido", entity: "categoria", entity_id: id, before: deleted,
            });
        }

        return deleted;
    },
};
