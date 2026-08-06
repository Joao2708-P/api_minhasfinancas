import type { Context } from "hono";
import {
    compoundSchema,
    loanSchema,
    goalContributionSchema,
    monthsToGoalSchema,
} from "../schemas/calculator.schema";
import {
    futureValueWithContributions,
    loanInstallment,
    requiredMonthlyForGoal,
    monthsToReachGoal,
} from "../lib/calculators";
import type { AppEnv } from "../types";

// Calculadoras de simulação: cálculo PURO, sem banco. Só exigem estar logado
// (authGuard) — não dependem de org/cliente. Entradas e saídas em centavos.
export const calculatorController = {
    // Juros compostos com aportes mensais.
    async compoundInterest(c: Context<AppEnv>) {
        const body = compoundSchema.parse(await c.req.json());
        return c.json(futureValueWithContributions(body));
    },

    // Financiamento pela Tabela Price (parcelas fixas).
    async loan(c: Context<AppEnv>) {
        const body = loanSchema.parse(await c.req.json());
        return c.json(loanInstallment(body));
    },

    // Aporte mensal necessário pra bater uma meta no prazo.
    async goalContribution(c: Context<AppEnv>) {
        const body = goalContributionSchema.parse(await c.req.json());
        return c.json({ monthlyContribution: requiredMonthlyForGoal(body) });
    },

    // Em quantos meses a meta é atingida com um dado aporte (null = inalcançável).
    async monthsToGoal(c: Context<AppEnv>) {
        const body = monthsToGoalSchema.parse(await c.req.json());
        return c.json({ months: monthsToReachGoal(body) });
    },
};
