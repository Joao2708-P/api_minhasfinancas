import type { Context } from "hono";
import { reportService } from "../services/report.service";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

// Lê ?from e ?to (datas ISO) da query string.
function parsePeriod(c: Context<AppEnv>) {
    const from = c.req.query("from");
    const to = c.req.query("to");
    return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
    };
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

    async goals(c: Context<AppEnv>) {
        const data = await reportService.goals(c.get("db"), scopeOf(c));
        return c.json(data);
    },
};
