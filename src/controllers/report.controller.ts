import type { Context } from "hono";
import { reportService } from "../services/report.service";
import type { AppEnv, Scope } from "../types";
import { parsePeriodParams } from "../lib/dates";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

// Lê ?from e ?to (datas ISO). `to` só-data inclui o dia inteiro; data inválida → 400.
function parsePeriod(c: Context<AppEnv>) {
    return parsePeriodParams(c.req.query("from"), c.req.query("to"));
}

export const reportController = {
    async summary(c: Context<AppEnv>) {
        const data = await reportService.summary(c.get("db"), scopeOf(c), parsePeriod(c));
        return c.json(data);
    },

    async byCategory(c: Context<AppEnv>) {
        const data = await reportService.byCategory(c.get("db"), scopeOf(c), parsePeriod(c));
        return c.json(data);
    },

    async byAccount(c: Context<AppEnv>) {
        const data = await reportService.byAccount(c.get("db"), scopeOf(c), parsePeriod(c));
        return c.json(data);
    },

    async cashflow(c: Context<AppEnv>) {
        const data = await reportService.monthlyCashflow(c.get("db"), scopeOf(c), parsePeriod(c));
        return c.json(data);
    },

    // Fluxo de caixa PROJETADO: saldo atual + contas a pagar/receber pendentes,
    // mês a mês. ?months= (1..24, padrão 6).
    async projectedCashflow(c: Context<AppEnv>) {
        const months = Number(c.req.query("months") ?? 6);
        const data = await reportService.projectedCashflow(
            c.get("db"),
            scopeOf(c),
            Number.isFinite(months) ? months : 6,
        );
        return c.json(data);
    },

    async goals(c: Context<AppEnv>) {
        const data = await reportService.goals(c.get("db"), scopeOf(c));
        return c.json(data);
    },
};
