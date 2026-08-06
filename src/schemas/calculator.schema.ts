import { z } from "zod";

// Entradas das calculadoras de simulação. Valores monetários em CENTAVOS
// (inteiros), taxa anual em % (aceita decimal), meses inteiros.
// Mensagens em português (convenção do projeto).

const cents = z.number().int("Use centavos (inteiro)").nonnegative("Não pode ser negativo");
const annualRatePct = z.number().min(0, "A taxa não pode ser negativa");

export const compoundSchema = z.object({
    principal: cents,
    monthlyContribution: cents,
    annualRatePct,
    months: z.number().int().min(0, "Meses não pode ser negativo"),
});

export const loanSchema = z.object({
    principal: z.number().int().positive("O valor financiado deve ser positivo"),
    annualRatePct,
    months: z.number().int().min(1, "O financiamento precisa de ao menos 1 parcela"),
});

export const goalContributionSchema = z.object({
    target: cents,
    current: cents,
    months: z.number().int().min(1, "O prazo precisa de ao menos 1 mês"),
    annualRatePct: annualRatePct.optional(),
});

export const monthsToGoalSchema = z.object({
    target: cents,
    current: cents,
    monthlyContribution: cents,
    annualRatePct: annualRatePct.optional(),
    maxMonths: z.number().int().positive().optional(),
});

export type CompoundBody = z.infer<typeof compoundSchema>;
export type LoanBody = z.infer<typeof loanSchema>;
export type GoalContributionBody = z.infer<typeof goalContributionSchema>;
export type MonthsToGoalBody = z.infer<typeof monthsToGoalSchema>;
