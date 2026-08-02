import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../database";
import { account, category, transaction } from "../database/schema";
import type { CreateTransactionInput, UpdateTransactionInput } from "../schemas";
import { ForbiddenError, NotFoundError } from "../errors/errors";

export type TransactionFilters = {
    account_id?: string;
    category_id?: string;
    type?: "in" | "out";
    from?: Date;
    to?: Date;
};

// Garante que a conta pertence ao usuário (senão a transação vazaria dados).
async function assertAccountOwned(db: Database, userId: string, accountId: string) {
    const acc = await db.query.account.findFirst({
        where: and(eq(account.id, accountId), eq(account.user_id, userId)),
    });
    if (!acc) throw new ForbiddenError("Conta não pertence ao usuário");
}

// Garante que a categoria (se informada) pertence ao usuário.
async function assertCategoryOwned(db: Database, userId: string, categoryId?: string) {
    if (!categoryId) return;
    const cat = await db.query.category.findFirst({
        where: and(eq(category.id, categoryId), eq(category.user_id, userId)),
    });
    if (!cat) throw new ForbiddenError("Categoria não pertence ao usuário");
}

export const transactionService = {
    async findByIdOwned(db: Database, userId: string, id: string) {
        return db.query.transaction.findFirst({
            where: and(eq(transaction.id, id), eq(transaction.user_id, userId)),
        });
    },

    async listByUser(db: Database, userId: string, filters: TransactionFilters = {}) {
        const conditions = [eq(transaction.user_id, userId)];

        if (filters.account_id) conditions.push(eq(transaction.account_id, filters.account_id));
        if (filters.category_id) conditions.push(eq(transaction.category_id, filters.category_id));
        if (filters.type) conditions.push(eq(transaction.type, filters.type));
        if (filters.from) conditions.push(gte(transaction.date, filters.from));
        if (filters.to) conditions.push(lte(transaction.date, filters.to));

        return db.query.transaction.findMany({
            where: and(...conditions),
            orderBy: [desc(transaction.date)],
        });
    },

    async create(db: Database, userId: string, input: CreateTransactionInput) {
        await assertAccountOwned(db, userId, input.account_id);
        await assertCategoryOwned(db, userId, input.category_id);

        const [created] = await db
            .insert(transaction)
            .values({ ...input, user_id: userId })
            .returning();

        return created;
    },

    async update(db: Database, userId: string, id: string, input: UpdateTransactionInput) {
        const existing = await this.findByIdOwned(db, userId, id);
        if (!existing) throw new NotFoundError("Transação");

        if (input.account_id) await assertAccountOwned(db, userId, input.account_id);
        if (input.category_id) await assertCategoryOwned(db, userId, input.category_id);

        const [updated] = await db
            .update(transaction)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(transaction.id, id), eq(transaction.user_id, userId)))
            .returning();

        return updated;
    },

    async delete(db: Database, userId: string, id: string) {
        const [deleted] = await db
            .delete(transaction)
            .where(and(eq(transaction.id, id), eq(transaction.user_id, userId)))
            .returning();

        return deleted;
    },
};
