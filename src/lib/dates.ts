// Datas — lógica PURA (sem I/O), testável.
//
// Convenção do sistema: datas "de calendário" (vencimento, data da transação vinda
// de um <input type=date>) chegam como "YYYY-MM-DD" e viram 00:00 UTC. Todas as
// contas de dia/mês aqui são feitas em UTC para casar com isso.

import { BadRequestError } from "../errors/errors";

export const DAY_MS = 86_400_000;

// Brasil sem horário de verão desde 2019 → offset fixo de Brasília (UTC−3). Usado só
// para saber "que dia é hoje" do ponto de vista do usuário.
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Converte um parâmetro de query em Date. String inválida → 400 (em vez de virar
// `Invalid Date` e filtrar nada em silêncio). Com `endOfDay`, uma data SEM hora
// ("2026-10-31") passa a incluir o dia inteiro (23:59:59.999) — senão `?to=` cortaria
// todo o último dia do período.
export function parseDateParam(
    raw: string | undefined,
    opts: { endOfDay?: boolean; field?: string } = {},
): Date | undefined {
    if (!raw) return undefined;
    const d = new Date(raw);
    if (isNaN(d.getTime())) throw new BadRequestError(`Data inválida em "${opts.field ?? "data"}"`);
    if (opts.endOfDay && DATE_ONLY.test(raw)) return new Date(d.getTime() + DAY_MS - 1);
    return d;
}

// Lê o par ?from=&to= (o `to` é inclusivo quando vem só a data).
export function parsePeriodParams(from?: string, to?: string): { from?: Date; to?: Date } {
    return {
        from: parseDateParam(from, { field: "from" }),
        to: parseDateParam(to, { endOfDay: true, field: "to" }),
    };
}

// "Hoje" (00:00 UTC do dia corrente no fuso de Brasília). Comparável com vencimentos.
export function todayUtc(now: Date = new Date()): Date {
    const local = new Date(now.getTime() + BRT_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

// Pendente com vencimento ANTERIOR a hoje. No próprio dia do vencimento ainda não
// está atrasado (antes comparava com o instante atual e marcava "atrasado" já às
// 21h da véspera, por causa do 00:00 UTC).
export function isOverdue(status: string, dueDate: Date, now: Date = new Date()): boolean {
    return status === "pending" && dueDate.getTime() < todayUtc(now).getTime();
}

// "YYYY-MM" (UTC) de uma data.
export function monthKey(d: Date): string {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Soma meses mantendo o dia, com CLAMP no fim do mês: 31/jan + 1 mês = 28/fev (ou 29),
// não 03/mar (que é o que `setMonth` faria). `anchorDay` permite manter o dia original
// ao longo de uma série (31/jan → 28/fev → 31/mar), em vez de "grudar" no 28.
export function addMonthsClamped(date: Date, months: number, anchorDay?: number): Date {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + months;
    const day = anchorDay ?? date.getUTCDate();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(
        Date.UTC(
            year,
            month,
            Math.min(day, lastDay),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds(),
        ),
    );
}

export type Recurrence = "once" | "monthly" | "weekly";

// Próxima ocorrência de um compromisso recorrente (null para 'once').
export function nextOccurrence(date: Date, recurrence: Recurrence, anchorDay?: number): Date | null {
    if (recurrence === "weekly") return new Date(date.getTime() + 7 * DAY_MS);
    if (recurrence === "monthly") return addMonthsClamped(date, 1, anchorDay);
    return null;
}
