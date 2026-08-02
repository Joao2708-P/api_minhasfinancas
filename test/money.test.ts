import { describe, it, expect } from "vitest";
import { toCents, fromCents, formatBRL } from "../src/lib/money";

describe("money", () => {
    it("converte reais para centavos arredondando", () => {
        expect(toCents(10)).toBe(1000);
        expect(toCents(10.5)).toBe(1050);
        expect(toCents(0.1)).toBe(10);
        // arredondamento de ponto flutuante
        expect(toCents(19.99)).toBe(1999);
    });

    it("converte centavos para reais", () => {
        expect(fromCents(1000)).toBe(10);
        expect(fromCents(1999)).toBe(19.99);
    });

    it("formata em BRL", () => {
        const s = formatBRL(1999);
        expect(s).toContain("R$");
        expect(s).toContain("19,99");
    });
});
