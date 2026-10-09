import { describe, it, expect } from "vitest";
import { addMonthsClamped, isOverdue, nextOccurrence, parseDateParam, parsePeriodParams, todayUtc } from "../src/lib/dates";

const d = (iso: string) => new Date(iso);

describe("addMonthsClamped / nextOccurrence", () => {
    it("mantém o dia quando existe no mês seguinte", () => {
        expect(addMonthsClamped(d("2026-01-15T00:00:00Z"), 1).toISOString()).toBe("2026-02-15T00:00:00.000Z");
    });

    it("faz clamp no fim do mês (31/jan → 28/fev, não 03/mar)", () => {
        expect(addMonthsClamped(d("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
        expect(addMonthsClamped(d("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    });

    it("com anchorDay volta ao dia original depois de um mês curto", () => {
        expect(addMonthsClamped(d("2026-02-28T00:00:00Z"), 1, 31).toISOString()).toBe("2026-03-31T00:00:00.000Z");
    });

    it("vira o ano", () => {
        expect(addMonthsClamped(d("2026-12-10T00:00:00Z"), 1).toISOString()).toBe("2027-01-10T00:00:00.000Z");
    });

    it("próxima ocorrência por recorrência", () => {
        expect(nextOccurrence(d("2026-10-01T00:00:00Z"), "weekly")!.toISOString()).toBe("2026-10-08T00:00:00.000Z");
        expect(nextOccurrence(d("2026-10-01T00:00:00Z"), "monthly")!.toISOString()).toBe("2026-11-01T00:00:00.000Z");
        expect(nextOccurrence(d("2026-10-01T00:00:00Z"), "once")).toBeNull();
    });
});

describe("todayUtc / isOverdue", () => {
    it("usa o dia de Brasília: 22h BRT do dia 15 ainda é dia 15", () => {
        // 2026-10-16T01:00Z = 15/10 22:00 em Brasília
        expect(todayUtc(d("2026-10-16T01:00:00Z")).toISOString()).toBe("2026-10-15T00:00:00.000Z");
    });

    it("não está atrasado no próprio dia do vencimento", () => {
        const due = d("2026-10-15T00:00:00Z");
        expect(isOverdue("pending", due, d("2026-10-15T23:00:00Z"))).toBe(false); // 20h BRT
        expect(isOverdue("pending", due, d("2026-10-16T01:00:00Z"))).toBe(false); // 22h BRT do dia 15
        expect(isOverdue("pending", due, d("2026-10-16T04:00:00Z"))).toBe(true);  // 01h BRT do dia 16
    });

    it("pago/cancelado nunca está atrasado", () => {
        const due = d("2020-01-01T00:00:00Z");
        expect(isOverdue("paid", due)).toBe(false);
        expect(isOverdue("canceled", due)).toBe(false);
    });
});

describe("parseDateParam / parsePeriodParams", () => {
    it("ausente → undefined", () => {
        expect(parseDateParam(undefined)).toBeUndefined();
    });

    it("data inválida → erro 400 (em vez de Invalid Date silencioso)", () => {
        expect(() => parseDateParam("banana", { field: "from" })).toThrow(/from/);
    });

    it("`to` só-data inclui o dia inteiro", () => {
        const { from, to } = parsePeriodParams("2026-10-01", "2026-10-31");
        expect(from!.toISOString()).toBe("2026-10-01T00:00:00.000Z");
        expect(to!.toISOString()).toBe("2026-10-31T23:59:59.999Z");
    });

    it("`to` com hora explícita é respeitado", () => {
        const { to } = parsePeriodParams(undefined, "2026-10-31T12:00:00.000Z");
        expect(to!.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    });
});
