import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../database";
import { account, transaction } from "../database/schema";
import type { CreateAccountInput, UpdateAccountInput } from "../schemas";

export const accountService = {
    // Busca uma conta garantindo que ela pertence ao usuário.
    async findByIdOwned(db: Database, userId: string, id: string) {
        return db.query.account.findFirst({
            where: and(eq(account.id, id), eq(account.user_id, userId)),
        });
    },

    async listByUser(db: Database, userId: string) {
        return db.query.account.findMany({
            where: eq(account.user_id, userId),
        });
    },

    async create(db: Database, userId: string, input: CreateAccountInput) {
        const [created] = await db
            .insert(account)
            .values({ ...input, user_id: userId })
            .returning();

        return created;
    },

    async update(db: Database, userId: string, id: string, input: UpdateAccountInput) {
        const [updated] = await db
            .update(account)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(account.id, id), eq(account.user_id, userId)))
            .returning();

        return updated;
    },

    async delete(db: Database, userId: string, id: string) {
        const [deleted] = await db
            .delete(account)
            .where(and(eq(account.id, id), eq(account.user_id, userId)))
            .returning();

        return deleted;
    },

    // Saldo atual = saldo de abertura + entradas - saídas (tudo em centavos).
    async currentBalance(db: Database, accountId: string, openingBalance: number) {
        const [row] = await db
            .select({
                incomes: sql<number>`coalesce(sum(case when ${transaction.type} = 'in' then ${transaction.value} else 0 end), 0)`,
                expenses: sql<number>`coalesce(sum(case when ${transaction.type} = 'out' then ${transaction.value} else 0 end), 0)`,
            })
            .from(transaction)
            .where(eq(transaction.account_id, accountId));

        const incomes = Number(row?.incomes ?? 0);
        const expenses = Number(row?.expenses ?? 0);

        return openingBalance + incomes - expenses;
    },
};
