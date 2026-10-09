import { describe, it, expect } from "vitest";
import { assetPerformance, summarizeAssets, type AssetLike } from "../src/lib/assets";

const asset = (p: Partial<AssetLike>): AssetLike => ({
    kind: "investment",
    investmentClass: "fixed_income",
    acquisitionValue: 100000,
    currentValue: 100000,
    acquiredAt: null,
    ...p,
});

describe("assetPerformance", () => {
    it("ganho e % sobre o custo", () => {
        const r = assetPerformance(asset({ acquisitionValue: 100000, currentValue: 112000 }));
        expect(r.gain).toBe(12000);
        expect(r.gainPct).toBeCloseTo(0.12, 10);
        expect(r.annualizedPct).toBeNull(); // sem data de aquisição
    });

    it("anualiza o retorno: +21% em 2 anos ≈ 10% a.a.", () => {
        const now = new Date("2026-10-09T00:00:00Z");
        const acquiredAt = new Date(now.getTime() - 730 * 86_400_000);
        const r = assetPerformance(asset({ acquisitionValue: 100000, currentValue: 121000, acquiredAt }), now);
        expect(r.annualizedPct).toBeCloseTo(0.1, 3);
    });

    it("não anualiza com menos de 30 dias (número explode e engana)", () => {
        const now = new Date("2026-10-09T00:00:00Z");
        const acquiredAt = new Date("2026-10-01T00:00:00Z");
        expect(assetPerformance(asset({ currentValue: 101000, acquiredAt }), now).annualizedPct).toBeNull();
    });

    it("custo zero (bem recebido em doação/herança): sem %", () => {
        const r = assetPerformance(asset({ acquisitionValue: 0, currentValue: 50000 }));
        expect(r.gain).toBe(50000);
        expect(r.gainPct).toBeNull();
    });
});

describe("summarizeAssets", () => {
    it("totaliza, quebra por tipo/classe e soma o patrimônio líquido com as contas", () => {
        const r = summarizeAssets(
            [
                asset({ kind: "real_estate", investmentClass: null, acquisitionValue: 30000000, currentValue: 45000000 }),
                asset({ investmentClass: "stocks", acquisitionValue: 1000000, currentValue: 900000 }),
                asset({ investmentClass: "fixed_income", acquisitionValue: 4000000, currentValue: 4100000 }),
            ],
            250000,
        );
        expect(r.count).toBe(3);
        expect(r.current).toBe(50000000);
        expect(r.acquisition).toBe(35000000);
        expect(r.gain).toBe(15000000);
        expect(r.netWorth).toBe(50250000);

        const imovel = r.byKind.find((k) => k.kind === "real_estate")!;
        expect(imovel.current).toBe(45000000);
        expect(imovel.share).toBeCloseTo(0.9, 10);

        expect(r.byInvestmentClass.map((c) => c.investmentClass).sort()).toEqual(["fixed_income", "stocks"]);
        expect(r.byInvestmentClass.find((c) => c.investmentClass === "stocks")!.gain).toBe(-100000);
    });

    it("sem bens: patrimônio = saldo das contas", () => {
        const r = summarizeAssets([], -5000);
        expect(r.netWorth).toBe(-5000);
        expect(r.gainPct).toBeNull();
        expect(r.byKind).toEqual([]);
    });
});
