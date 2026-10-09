// Fluxo de caixa PROJETADO — lógica pura (sem I/O), testável.
//
// Parte do saldo atual (abertura das contas + Σ transações) e aplica os compromissos
// PENDENTES (contas a pagar/receber) mês a mês. Recorrências são expandidas
// "virtualmente" a partir das linhas pendentes; como a baixa de uma recorrente gera a
// próxima ocorrência real, só expandimos a partir de linhas ainda pendentes — isso
// evita contar a mesma parcela duas vezes.

import { addMonthsClamped, DAY_MS, monthKey, todayUtc, type Recurrence } from "./dates";

export type ProjectionItem = {
    direction: "payable" | "receivable";
    description?: string;   // identifica a série de uma recorrente
    value: number;          // centavos
    dueDate: Date;
    recurrence: Recurrence;
    anchorDay?: number | null; // dia original do vencimento mensal (ver schema)
};

// Série de uma recorrente: linhas pendentes da mesma conta (ex.: uma baixa reaberta deixa
// a de out E a de nov pendentes). Só a ÚLTIMA de cada série expande ocorrências virtuais —
// senão cada linha projetaria a sua própria sequência e os meses seguintes contariam 2×.
const seriesKey = (it: ProjectionItem) =>
    `${it.direction}|${it.description ?? ""}|${it.value}|${it.recurrence}`;

export type ProjectionBucket = {
    month: string;          // "YYYY-MM"
    receivables: number;    // a receber no mês (centavos)
    payables: number;       // a pagar no mês (centavos)
    net: number;            // receivables − payables
    balance: number;        // saldo projetado ao FIM do mês
};

export type ProjectionResult = {
    openingBalance: number;      // saldo atual (ponto de partida)
    overdueReceivables: number;  // atrasados (já contados no 1º mês)
    overduePayables: number;
    buckets: ProjectionBucket[];
    finalBalance: number;
    // Primeiro mês em que o saldo projetado fica negativo (alerta de caixa), ou null.
    firstNegativeMonth: string | null;
};

// Teto de ocorrências por linha — proteção contra laço longo (semanal em 24 meses ≈ 105).
const MAX_OCCURRENCES = 200;

export function projectCashflow(input: {
    openingBalance: number;
    items: ProjectionItem[];
    months: number;        // horizonte (1..24), a partir do mês corrente
    now?: Date;
}): ProjectionResult {
    const today = todayUtc(input.now);
    const months = Math.min(24, Math.max(1, Math.floor(input.months)));

    // Meses do horizonte e fim do último (inclusivo).
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const keys: string[] = [];
    for (let i = 0; i < months; i++) keys.push(monthKey(addMonthsClamped(start, i)));
    const horizonEnd = new Date(addMonthsClamped(start, months).getTime() - 1);

    const map = new Map<string, { receivables: number; payables: number }>(
        keys.map((k) => [k, { receivables: 0, payables: 0 }]),
    );
    const add = (key: string, it: ProjectionItem) => {
        const b = map.get(key);
        if (!b) return;
        if (it.direction === "receivable") b.receivables += it.value;
        else b.payables += it.value;
    };

    let overdueReceivables = 0;
    let overduePayables = 0;

    const latestOfSeries = new Map<string, ProjectionItem>();
    for (const it of input.items) {
        if (it.recurrence === "once") continue;
        const cur = latestOfSeries.get(seriesKey(it));
        if (!cur || it.dueDate.getTime() > cur.dueDate.getTime()) latestOfSeries.set(seriesKey(it), it);
    }

    for (const it of input.items) {
        // A própria linha: atrasada → cai no 1º mês (ainda vai ter que sair/entrar).
        if (it.dueDate.getTime() < today.getTime()) {
            add(keys[0], it);
            if (it.direction === "receivable") overdueReceivables += it.value;
            else overduePayables += it.value;
        } else if (it.dueDate.getTime() <= horizonEnd.getTime()) {
            add(monthKey(it.dueDate), it);
        }

        // Ocorrências futuras (virtuais) de uma recorrente. Ocorrências intermediárias
        // que já passaram não são somadas: só a linha real conta como atrasada.
        if (it.recurrence === "once" || latestOfSeries.get(seriesKey(it)) !== it) continue;
        const anchorDay = it.anchorDay ?? it.dueDate.getUTCDate();
        for (let n = 1; n <= MAX_OCCURRENCES; n++) {
            const d = it.recurrence === "weekly"
                ? new Date(it.dueDate.getTime() + n * 7 * DAY_MS)
                : addMonthsClamped(it.dueDate, n, anchorDay);
            if (d.getTime() > horizonEnd.getTime()) break;
            if (d.getTime() >= today.getTime()) add(monthKey(d), it);
        }
    }

    let balance = input.openingBalance;
    let firstNegativeMonth: string | null = null;
    const buckets: ProjectionBucket[] = keys.map((month) => {
        const b = map.get(month)!;
        const net = b.receivables - b.payables;
        balance += net;
        if (balance < 0 && firstNegativeMonth === null) firstNegativeMonth = month;
        return { month, receivables: b.receivables, payables: b.payables, net, balance };
    });

    return {
        openingBalance: input.openingBalance,
        overdueReceivables,
        overduePayables,
        buckets,
        finalBalance: balance,
        firstNegativeMonth,
    };
}
