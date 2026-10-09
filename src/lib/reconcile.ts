// Conciliação (transação ↔ conta a pagar/receber) — lógica pura, testável.
//
// Usada em dois lugares:
//   - ingestão (auto-baixa): só casa quando o par é INEQUÍVOCO;
//   - tela de baixa manual: sugere transações candidatas, ordenadas por proximidade.

import { DAY_MS } from "./dates";

export type Direction = "payable" | "receivable";
export type TxType = "in" | "out";

export type ReconTx = { id: string; type: TxType; value: number; date: Date };
export type ReconItem = { id: string; direction: Direction; value: number; dueDate: Date };

// A pagar é quitada por uma SAÍDA; a receber, por uma ENTRADA.
export const typeForDirection = (d: Direction): TxType => (d === "payable" ? "out" : "in");

export const RECONCILE_WINDOW_DAYS = 5;

const dayDistance = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / DAY_MS;

function isMatch(item: ReconItem, tx: ReconTx, windowDays: number): boolean {
    return (
        tx.type === typeForDirection(item.direction) &&
        tx.value === item.value &&
        dayDistance(tx.date, item.dueDate) <= windowDays
    );
}

// Auto-conciliação: pareia transação ↔ compromisso SÓ quando a relação é 1-para-1
// nos dois sentidos (a transação tem exatamente um compromisso compatível E esse
// compromisso tem exatamente uma transação compatível no lote). Duas saídas iguais
// de R$ 100 contra um único boleto de R$ 100 = ambíguo → ninguém é baixado
// automaticamente (antes, a primeira transação "ganhava" por ordem de chegada).
export function autoMatch(
    txs: ReconTx[],
    items: ReconItem[],
    windowDays = RECONCILE_WINDOW_DAYS,
): { pairs: { txId: string; itemId: string }[]; ambiguous: number } {
    const itemsByTx = new Map<string, ReconItem[]>();
    const txCountByItem = new Map<string, number>();

    for (const tx of txs) {
        const cands = items.filter((it) => isMatch(it, tx, windowDays));
        itemsByTx.set(tx.id, cands);
        for (const it of cands) txCountByItem.set(it.id, (txCountByItem.get(it.id) ?? 0) + 1);
    }

    const pairs: { txId: string; itemId: string }[] = [];
    let ambiguous = 0;
    for (const tx of txs) {
        const cands = itemsByTx.get(tx.id)!;
        if (cands.length === 0) continue;
        if (cands.length === 1 && txCountByItem.get(cands[0].id) === 1) {
            pairs.push({ txId: tx.id, itemId: cands[0].id });
        } else {
            ambiguous++;
        }
    }
    return { pairs, ambiguous };
}

export type Suggestion<T extends ReconTx> = T & { valueDiff: number; dayDiff: number; exact: boolean };

// Sugestões para a baixa manual: mesmo tipo, data dentro da janela e valor dentro de
// uma tolerância (juros/multa/desconto mudam o valor pago). Valor exato primeiro,
// depois menor diferença de valor, depois menor distância de data.
export function rankCandidates<T extends ReconTx>(
    item: ReconItem,
    txs: T[],
    opts: { windowDays?: number; valueTolerancePct?: number; limit?: number } = {},
): Suggestion<T>[] {
    const windowDays = opts.windowDays ?? 15;
    const tol = Math.round(item.value * ((opts.valueTolerancePct ?? 10) / 100));
    const type = typeForDirection(item.direction);

    return txs
        .filter((tx) => tx.type === type)
        .map((tx) => ({
            ...tx,
            valueDiff: Math.abs(tx.value - item.value),
            dayDiff: Math.round(dayDistance(tx.date, item.dueDate)),
            exact: tx.value === item.value,
        }))
        .filter((s) => s.valueDiff <= tol && s.dayDiff <= windowDays)
        .sort((a, b) => Number(b.exact) - Number(a.exact) || a.valueDiff - b.valueDiff || a.dayDiff - b.dayDiff)
        .slice(0, opts.limit ?? 10);
}
