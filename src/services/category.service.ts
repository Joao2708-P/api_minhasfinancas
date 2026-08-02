import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { category } from "../database/schema";
import type { CreateCategoryInput, UpdateCategoryInput } from "../schemas";

export const CategoryService = {
    // Busca garantindo que a categoria pertence ao usuário.
    async findByIdOwned(db: Database, userId: string, id: string) {
        return db.query.category.findFirst({
            where: and(eq(category.id, id), eq(category.user_id, userId)),
        });
    },

    async listByUser(db: Database, userId: string) {
        return db.query.category.findMany({
            where: eq(category.user_id, userId),
        });
    },

    async create(db: Database, userId: string, input: CreateCategoryInput) {
        const [newCategory] = await db
            .insert(category)
            .values({ ...input, user_id: userId })
            .returning();

        return newCategory;
    },

    async update(db: Database, userId: string, id: string, updateInput: UpdateCategoryInput) {
        const [updated] = await db
            .update(category)
            .set({ ...updateInput, updateAt: new Date() })
            .where(and(eq(category.id, id), eq(category.user_id, userId)))
            .returning();

        return updated;
    },

    async delete(db: Database, userId: string, id: string) {
        const [deleted] = await db
            .delete(category)
            .where(and(eq(category.id, id), eq(category.user_id, userId)))
            .returning();

        return deleted;
    },
};
