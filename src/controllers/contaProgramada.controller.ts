import type { Context } from "hono";
import {
    createContaProgramadaSchema,
    updateContaProgramadaSchema,
    settleContaProgramadaSchema,
} from "../schemas";
import { contaProgramadaService, type ContaProgramadaFilters } from "../services/contaProgramada.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

function parseFilters(c: Context<AppEnv>): ContaProgramadaFilters {
    const f: ContaProgramadaFilters = {};
    const dir = c.req.query("direction");
    const status = c.req.query("status");
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (dir === "payable" || dir === "receivable") f.direction = dir;
    if (status === "pending" || status === "paid" || status === "overdue" || status === "canceled") f.status = status;
    if (from) f.from = new Date(from);
    if (to) f.to = new Date(to);
    return f;
}

export const contaProgramadaController = {
    async list(c: Context<AppEnv>) {
        return c.json(await contaProgramadaService.listByScope(c.get("db"), scopeOf(c), parseFilters(c)));
    },

    async getById(c: Context<AppEnv>) {
        const row = await contaProgramadaService.findByIdOwned(c.get("db"), scopeOf(c), c.req.param("id")!);
        if (!row) throw new NotFoundError("Conta programada");
        return c.json(row);
    },

    async create(c: Context<AppEnv>) {
        const body = createContaProgramadaSchema.parse(await c.req.json());
        const created = await contaProgramadaService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(created, 201);
    },

    async update(c: Context<AppEnv>) {
        const body = updateContaProgramadaSchema.parse(await c.req.json());
        const updated = await contaProgramadaService.update(c.get("db"), scopeOf(c), c.req.param("id")!, body, c.get("userId"));
        return c.json(updated);
    },

    // Baixa/conciliação — marca como paga e (opcional) vincula a transação.
    async settle(c: Context<AppEnv>) {
        const body = settleContaProgramadaSchema.parse(await c.req.json().catch(() => ({})));
        const updated = await contaProgramadaService.settle(c.get("db"), scopeOf(c), c.req.param("id")!, body, c.get("userId"));
        return c.json(updated);
    },

    async remove(c: Context<AppEnv>) {
        const deleted = await contaProgramadaService.delete(c.get("db"), scopeOf(c), c.req.param("id")!, c.get("userId"));
        if (!deleted) throw new NotFoundError("Conta programada");
        return c.json(deleted);
    },
};
