import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { category } from "../database/schema";
import type { CreateCategoryInput, UpdateCategoryInput } from "../schemas";
import type { Scope } from "../types";

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

    async create(db: Database, s: Scope, input: CreateCategoryInput) {
        const [newCategory] = await db
            .insert(category)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        return newCategory;
    },

    async update(db: Database, s: Scope, id: string, updateInput: UpdateCategoryInput) {
        const [updated] = await db
            .update(category)
            .set({ ...updateInput, updateAt: new Date() })
            .where(and(eq(category.id, id), inScope(s)))
            .returning();

        return updated;
    },

    async delete(db: Database, s: Scope, id: string) {
        const [deleted] = await db
            .delete(category)
            .where(and(eq(category.id, id), inScope(s)))
            .returning();

        return deleted;
    },
};
