import { describe, it, expect } from "vitest";
import {
    futureValueWithContributions,
    loanInstallment,
    requiredMonthlyForGoal,
    monthsToReachGoal,
} from "../src/lib/calculators";

describe("futureValueWithContributions", () => {
    it("sem juros: é só a soma do inicial + aportes", () => {
        const r = futureValueWithContributions({
            principal: 100000,
            monthlyContribution: 50000,
            annualRatePct: 0,
            months: 10,
        });
        expect(r).toEqual({ futureValue: 600000, totalContributed: 600000, totalInterest: 0 });
    });

    it("taxa mensal EQUIVALENTE: 12 meses compostos reproduzem exatamente a taxa anual", () => {
        // Com a nominal (aa/12) o resultado seria 112.683 (12,68% a.a.) — superestimado.
        const r = futureValueWithContributions({
            principal: 100000,
            monthlyContribution: 0,
            annualRatePct: 12,
            months: 12,
        });
        expect(r.futureValue).toBe(112000);
    });

    it("juros compostos com aportes mensais (12% a.a. ≈ 0,9489% a.m., 12 meses)", () => {
        const r = futureValueWithContributions({
            principal: 0,
            monthlyContribution: 100000, // R$ 1.000/mês
            annualRatePct: 12,
            months: 12,
        });
        expect(r.futureValue).toBe(1264650);
        expect(r.totalContributed).toBe(1200000);
        expect(r.totalInterest).toBe(64650);
    });

    it("horizonte zero devolve o principal", () => {
        const r = futureValueWithContributions({
            principal: 100000,
            monthlyContribution: 100000,
            annualRatePct: 10,
            months: 0,
        });
        expect(r.futureValue).toBe(100000);
    });
});

describe("loanInstallment (Tabela Price)", () => {
    it("sem juros: parcela é o principal dividido pelo número de meses", () => {
        const r = loanInstallment({ principal: 1200000, annualRatePct: 0, months: 12 });
        expect(r).toEqual({ installment: 100000, lastInstallment: 100000, totalPaid: 1200000, totalInterest: 0 });
    });

    it("última parcela absorve o arredondamento: soma das parcelas = principal (sem juros)", () => {
        // 1000,00 / 3 = 333,33 → 333,33 + 333,33 + 333,34
        const r = loanInstallment({ principal: 100000, annualRatePct: 0, months: 3 });
        expect(r.installment).toBe(33333);
        expect(r.lastInstallment).toBe(33334);
        expect(r.totalPaid).toBe(100000);
    });

    it("com juros (12% a.a., 12x): parcela fixa e juros totais coerentes", () => {
        const r = loanInstallment({ principal: 1000000, annualRatePct: 12, months: 12 });
        expect(r.installment).toBe(88562);
        expect(r.lastInstallment).toBe(88562);
        expect(r.totalPaid).toBe(88562 * 11 + r.lastInstallment);
        expect(r.totalInterest).toBe(r.totalPaid - 1000000);
    });
});

describe("requiredMonthlyForGoal", () => {
    it("sem juros: divide o que falta pelo prazo", () => {
        expect(requiredMonthlyForGoal({ target: 1200000, current: 0, months: 12 })).toBe(100000);
    });

    it("se o acumulado já atinge a meta, aporte necessário é 0", () => {
        expect(requiredMonthlyForGoal({ target: 100000, current: 100000, months: 12 })).toBe(0);
    });

    it("com rendimento, é o inverso do juros composto", () => {
        // Aportar R$1.000/mês a 12% a.a. por 12 meses chega a 1.264.650 (teste acima).
        expect(
            requiredMonthlyForGoal({ target: 1264650, current: 0, months: 12, annualRatePct: 12 }),
        ).toBe(100000);
    });
});

describe("monthsToReachGoal", () => {
    it("conta os meses até bater a meta (sem juros)", () => {
        expect(
            monthsToReachGoal({ target: 600000, current: 0, monthlyContribution: 100000, annualRatePct: 0 }),
        ).toBe(6);
    });

    it("meta já atingida devolve 0", () => {
        expect(
            monthsToReachGoal({ target: 100000, current: 100000, monthlyContribution: 0 }),
        ).toBe(0);
    });

    it("inalcançável (sem aporte e sem juros) devolve null", () => {
        expect(
            monthsToReachGoal({ target: 100000, current: 0, monthlyContribution: 0, annualRatePct: 0 }),
        ).toBeNull();
    });
});
