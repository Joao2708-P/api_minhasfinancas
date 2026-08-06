import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { Database } from "../database";
import { account, category, transaction } from "../database/schema";
import type { Scope } from "../types";
import { goalService, goalProgress } from "./goal.service";

type Period = { from?: Date; to?: Date };

// Condições comuns: tenant (org+cliente) + intervalo de datas.
function baseConditions(s: Scope, period: Period): SQL[] {
    const conditions: SQL[] = [
        eq(transaction.organizacao_id, s.orgId),
        eq(transaction.cliente_id, s.clienteId),
    ];
    if (period.from) conditions.push(gte(transaction.date, period.from));
    if (period.to) conditions.push(lte(transaction.date, period.to));
    return conditions;
}

const sumIn = sql<number>`coalesce(sum(case when ${transaction.type} = 'in' then ${transaction.value} else 0 end), 0)`;
const sumOut = sql<number>`coalesce(sum(case when ${transaction.type} = 'out' then ${transaction.value} else 0 end), 0)`;

export const reportService = {
    // Resumo geral: entradas, saídas e saldo do período (em centavos).
    async summary(db: Database, s: Scope, period: Period) {
        const [row] = await db
            .select({ incomes: sumIn, expenses: sumOut })
            .from(transaction)
            .where(and(...baseConditions(s, period)));

        const incomes = Number(row?.incomes ?? 0);
        const expenses = Number(row?.expenses ?? 0);

        return { incomes, expenses, balance: incomes - expenses };
    },

    // Totais agrupados por categoria.
    async byCategory(db: Database, s: Scope, period: Period) {
        const rows = await db
            .select({
                categoryId: transaction.category_id,
                categoryName: category.name,
                incomes: sumIn,
                expenses: sumOut,
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.category_id, category.id))
            .where(and(...baseConditions(s, period)))
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
    async byAccount(db: Database, s: Scope, period: Period) {
        const rows = await db
            .select({
                accountId: transaction.account_id,
                accountName: account.name,
                openingBalance: account.balance,
                incomes: sumIn,
                expenses: sumOut,
            })
            .from(transaction)
            .leftJoin(account, eq(transaction.account_id, account.id))
            .where(and(...baseConditions(s, period)))
            .groupBy(transaction.account_id);

        return rows.map((r) => ({
            accountId: r.accountId,
            accountName: r.accountName ?? "Sem conta",
            incomes: Number(r.incomes),
            expenses: Number(r.expenses),
            // `balance` = resultado do período (compat: o front já lê isto).
            balance: Number(r.incomes) - Number(r.expenses),
            // Aditivo: saldo de abertura da conta (o saldo ATUAL real, sem recorte
            // de período, vem de GET /accounts). Não somamos aqui pra não rotular
            // como "atual" um número que depende do período filtrado.
            openingBalance: Number(r.openingBalance ?? 0),
        }));
    },

    // Fluxo de caixa por mês (YYYY-MM).
    async monthlyCashflow(db: Database, s: Scope, period: Period) {
        const month = sql<string>`strftime('%Y-%m', ${transaction.date}, 'unixepoch')`;

        const rows = await db
            .select({ month, incomes: sumIn, expenses: sumOut })
            .from(transaction)
            .where(and(...baseConditions(s, period)))
            .groupBy(month)
            .orderBy(month);

        return rows.map((r) => ({
            month: r.month,
            incomes: Number(r.incomes),
            expenses: Number(r.expenses),
            balance: Number(r.incomes) - Number(r.expenses),
        }));
    },

    // Progresso de todas as metas do cliente.
    async goals(db: Database, s: Scope) {
        const goals = await goalService.listByScope(db, s);
        return goals.map((g) => ({ ...g, ...goalProgress(g.target_value, g.current_value) }));
    },
};
