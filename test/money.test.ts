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

    it("não perde o meio centavo por ruído de float (1.005 * 100 = 100.4999…)", () => {
        expect(toCents(1.005)).toBe(101);
        expect(toCents(4.35)).toBe(435);
        expect(toCents(0.285)).toBe(29);
    });

    it("arredonda negativos para longe do zero (simétrico)", () => {
        expect(toCents(-1.005)).toBe(-101);
        expect(toCents(-0.5)).toBe(-50);
        expect(toCents(-10.555)).toBe(-1056);
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
