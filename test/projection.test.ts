import { describe, it, expect } from "vitest";
import { projectCashflow, type ProjectionItem } from "../src/lib/projection";

// "Hoje" = 09/10/2026 (meio-dia em Brasília).
const now = new Date("2026-10-09T15:00:00Z");
const item = (p: Partial<ProjectionItem> & Pick<ProjectionItem, "direction" | "value" | "dueDate">): ProjectionItem => ({
    recurrence: "once",
    ...p,
});
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("projectCashflow", () => {
    it("sem compromissos: saldo constante em todos os meses", () => {
        const r = projectCashflow({ openingBalance: 100000, items: [], months: 3, now });
        expect(r.buckets.map((b) => b.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
        expect(r.buckets.every((b) => b.balance === 100000)).toBe(true);
        expect(r.finalBalance).toBe(100000);
        expect(r.firstNegativeMonth).toBeNull();
    });

    it("soma a receber, subtrai a pagar e acumula o saldo", () => {
        const r = projectCashflow({
            openingBalance: 100000,
            items: [
                item({ direction: "receivable", value: 50000, dueDate: day("2026-10-20") }),
                item({ direction: "payable", value: 30000, dueDate: day("2026-11-05") }),
            ],
            months: 2,
            now,
        });
        expect(r.buckets[0]).toMatchObject({ receivables: 50000, payables: 0, net: 50000, balance: 150000 });
        expect(r.buckets[1]).toMatchObject({ receivables: 0, payables: 30000, net: -30000, balance: 120000 });
    });

    it("atrasados entram no primeiro mês e são reportados à parte", () => {
        const r = projectCashflow({
            openingBalance: 0,
            items: [item({ direction: "payable", value: 20000, dueDate: day("2026-08-01") })],
            months: 2,
            now,
        });
        expect(r.overduePayables).toBe(20000);
        expect(r.buckets[0].payables).toBe(20000);
        expect(r.firstNegativeMonth).toBe("2026-10");
    });

    it("vencimento hoje não é atrasado", () => {
        const r = projectCashflow({
            openingBalance: 0,
            items: [item({ direction: "receivable", value: 1000, dueDate: day("2026-10-09") })],
            months: 1,
            now,
        });
        expect(r.overdueReceivables).toBe(0);
        expect(r.buckets[0].receivables).toBe(1000);
    });

    it("ignora compromissos depois do horizonte", () => {
        const r = projectCashflow({
            openingBalance: 0,
            items: [item({ direction: "payable", value: 1000, dueDate: day("2027-06-01") })],
            months: 3,
            now,
        });
        expect(r.finalBalance).toBe(0);
    });

    it("expande recorrência mensal mantendo o dia 31 (clamp no mês curto)", () => {
        const r = projectCashflow({
            openingBalance: 0,
            items: [item({ direction: "payable", value: 1000, dueDate: day("2026-10-31"), recurrence: "monthly" })],
            months: 6, // out..mar
            now,
        });
        // out, nov(30), dez, jan, fev(28), mar → 6 ocorrências, uma por mês.
        expect(r.buckets.map((b) => b.payables)).toEqual([1000, 1000, 1000, 1000, 1000, 1000]);
    });

    it("recorrente atrasada: a linha real conta como atrasada, ocorrências passadas virtuais não", () => {
        const r = projectCashflow({
            openingBalance: 0,
            // mensal vencida em 10/08: ocorrências 10/09 (passada, ignorada), 10/10, 10/11.
            items: [item({ direction: "payable", value: 1000, dueDate: day("2026-08-10"), recurrence: "monthly" })],
            months: 2,
            now,
        });
        expect(r.overduePayables).toBe(1000);
        expect(r.buckets[0].payables).toBe(2000); // atrasada + 10/10
        expect(r.buckets[1].payables).toBe(1000); // 10/11
    });

    it("série reaberta (duas linhas pendentes da mesma recorrente) não conta em dobro", () => {
        const aluguel = { direction: "payable" as const, description: "Aluguel", value: 1000, recurrence: "monthly" as const };
        const r = projectCashflow({
            openingBalance: 0,
            items: [
                { ...aluguel, dueDate: day("2026-10-10") }, // reaberta
                { ...aluguel, dueDate: day("2026-11-10") }, // gerada na baixa
            ],
            months: 4,
            now,
        });
        expect(r.buckets.map((b) => b.payables)).toEqual([1000, 1000, 1000, 1000]);
    });

    it("usa o dia-âncora: série do dia 31 volta a 31 depois de fevereiro", () => {
        const r = projectCashflow({
            openingBalance: 0,
            // linha atual já "clampada" em 28/02, mas a âncora é 31 → 31/03 cai em março.
            items: [item({ direction: "payable", value: 1000, dueDate: day("2027-02-28"), recurrence: "monthly", anchorDay: 31 })],
            months: 6, // out..mar
            now,
        });
        expect(r.buckets.map((b) => b.payables)).toEqual([0, 0, 0, 0, 1000, 1000]);
    });

    it("recorrência semanal cai em cada semana do mês", () => {
        const r = projectCashflow({
            openingBalance: 0,
            items: [item({ direction: "receivable", value: 100, dueDate: day("2026-10-12"), recurrence: "weekly" })],
            months: 1,
            now,
        });
        // 12, 19, 26 de outubro
        expect(r.buckets[0].receivables).toBe(300);
    });

    it("limita o horizonte a 1..24 meses", () => {
        expect(projectCashflow({ openingBalance: 0, items: [], months: 0, now }).buckets).toHaveLength(1);
        expect(projectCashflow({ openingBalance: 0, items: [], months: 99, now }).buckets).toHaveLength(24);
    });
});
