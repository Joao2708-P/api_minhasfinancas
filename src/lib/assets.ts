// Patrimônio (bens e investimentos) — lógica pura, testável. Valores em centavos.

import { DAY_MS } from "./dates";

export const ASSET_KINDS = ["real_estate", "vehicle", "investment", "other"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const INVESTMENT_CLASSES = [
    "fixed_income",       // renda fixa (CDB, LCI/LCA, Tesouro)
    "stocks",             // ações / ETFs
    "funds",              // fundos de investimento
    "real_estate_funds",  // FIIs
    "crypto",
    "pension",            // previdência (PGBL/VGBL)
    "savings",            // poupança
    "other",
] as const;
export type InvestmentClass = (typeof INVESTMENT_CLASSES)[number];

export type AssetLike = {
    kind: AssetKind;
    investmentClass: InvestmentClass | null;
    acquisitionValue: number;
    currentValue: number;
    acquiredAt: Date | null;
};

export type AssetPerformance = {
    gain: number;                    // valor atual − custo (centavos; negativo = perda)
    gainPct: number | null;          // ganho / custo (null se custo = 0)
    annualizedPct: number | null;    // retorno anualizado (null se sem data ou < 30 dias)
};

// Ganho e retorno anualizado: (atual/custo)^(365/dias) − 1. Abaixo de 30 dias o número
// anualizado explode (1% em 3 dias vira ~230% a.a.) e só confunde → null.
export function assetPerformance(a: AssetLike, now: Date = new Date()): AssetPerformance {
    const gain = a.currentValue - a.acquisitionValue;
    const gainPct = a.acquisitionValue > 0 ? gain / a.acquisitionValue : null;

    let annualizedPct: number | null = null;
    if (a.acquiredAt && a.acquisitionValue > 0 && a.currentValue >= 0) {
        const days = (now.getTime() - a.acquiredAt.getTime()) / DAY_MS;
        if (days >= 30) annualizedPct = Math.pow(a.currentValue / a.acquisitionValue, 365 / days) - 1;
    }
    return { gain, gainPct, annualizedPct };
}

type Totals = { count: number; acquisition: number; current: number; gain: number };
const emptyTotals = (): Totals => ({ count: 0, acquisition: 0, current: 0, gain: 0 });
const addTo = (t: Totals, a: AssetLike) => {
    t.count++;
    t.acquisition += a.acquisitionValue;
    t.current += a.currentValue;
    t.gain += a.currentValue - a.acquisitionValue;
};

// Consolida o patrimônio: totais, quebra por tipo de bem e por classe de investimento,
// e patrimônio líquido = saldo atual das contas + valor atual dos bens.
export function summarizeAssets(assets: AssetLike[], accountsBalance: number) {
    const total = emptyTotals();
    const byKind = new Map<AssetKind, Totals>();
    const byClass = new Map<InvestmentClass, Totals>();

    for (const a of assets) {
        addTo(total, a);
        if (!byKind.has(a.kind)) byKind.set(a.kind, emptyTotals());
        addTo(byKind.get(a.kind)!, a);
        if (a.kind === "investment") {
            const cls = a.investmentClass ?? "other";
            if (!byClass.has(cls)) byClass.set(cls, emptyTotals());
            addTo(byClass.get(cls)!, a);
        }
    }

    // Participação de cada fatia no total de bens (0..1), útil para o gráfico de alocação.
    const share = (v: number) => (total.current > 0 ? v / total.current : 0);

    return {
        ...total,
        gainPct: total.acquisition > 0 ? total.gain / total.acquisition : null,
        byKind: [...byKind].map(([kind, t]) => ({ kind, ...t, share: share(t.current) })),
        byInvestmentClass: [...byClass].map(([investmentClass, t]) => ({ investmentClass, ...t, share: share(t.current) })),
        accountsBalance,
        netWorth: accountsBalance + total.current,
    };
}
