import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "../database";
import { account, category, transaction } from "../database/schema";
import { goalService, goalProgress } from "./goal.service";

type Period = { from?: Date; to?: Date };

// Monta as condições comuns (usuário + intervalo de datas).
function baseConditions(userId: string, period: Period): SQL[] {
    const conditions: SQL[] = [eq(transaction.user_id, userId)];
    if (period.from) conditions.push(gte(transaction.date, period.from));
    if (period.to) conditions.push(lte(transaction.date, period.to));
    return conditions;
}

const sumIn = sql<number>`coalesce(sum(case when ${transaction.type} = 'in' then ${transaction.value} else 0 end), 0)`;
const sumOut = sql<number>`coalesce(sum(case when ${transaction.type} = 'out' then ${transaction.value} else 0 end), 0)`;

export const reportService = {
    // Resumo geral: entradas, saídas e saldo do período (em centavos).
    async summary(db: Database, userId: string, period: Period) {
        const [row] = await db
            .select({ incomes: sumIn, expenses: sumOut })
            .from(transaction)
            .where(and(...baseConditions(userId, period)));

        const incomes = Number(row?.incomes ?? 0);
        const expenses = Number(row?.expenses ?? 0);

        return { incomes, expenses, balance: incomes - expenses };
    },

    // Totais agrupados por categoria.
    async byCategory(db: Database, userId: string, period: Period) {
        const rows = await db
            .select({
                categoryId: transaction.category_id,
                categoryName: category.name,
                incomes: sumIn,
                expenses: sumOut,
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.category_id, category.id))
            .where(and(...baseConditions(userId, period)))
            .groupBy(transaction.category_id);

        return rows.map((r) => ({
            categoryId: r.categoryId,
            categoryName: r.categoryName ?? "Sem categoria",
            incomes: Number(r.incomes),
            expenses: Number(r.expenses),
            total: Number(r.incomes) - Number(r.expenses),
        }));
    },

    // Totais agrupados por conta.
    async byAccount(db: Database, userId: string, period: Period) {
        const rows = await db
            .select({
                accountId: transaction.account_id,
                accountName: account.name,
                incomes: sumIn,
                expenses: sumOut,
            })
            .from(transaction)
            .leftJoin(account, eq(transaction.account_id, account.id))
            .where(and(...baseConditions(userId, period)))
            .groupBy(transaction.account_id);

        return rows.map((r) => ({
            accountId: r.accountId,
            accountName: r.accountName ?? "Sem conta",
            incomes: Number(r.incomes),
            expenses: Number(r.expenses),
            balance: Number(r.incomes) - Number(r.expenses),
        }));
    },

    // Fluxo de caixa por mês (YYYY-MM).
    async monthlyCashflow(db: Database, userId: string, period: Period) {
        const month = sql<string>`strftime('%Y-%m', ${transaction.date}, 'unixepoch')`;

        const rows = await db
            .select({ month, incomes: sumIn, expenses: sumOut })
            .from(transaction)
            .where(and(...baseConditions(userId, period)))
            .groupBy(month)
            .orderBy(month);

        return rows.map((r) => ({
            month: r.month,
            incomes: Number(r.incomes),
            expenses: Number(r.expenses),
            balance: Number(r.incomes) - Number(r.expenses),
        }));
    },

    // Progresso de todas as metas do usuário.
    async goals(db: Database, userId: string) {
        const goals = await goalService.listByUser(db, userId);
        return goals.map((g) => ({ ...g, ...goalProgress(g.target_value, g.current_value) }));
    },
};
