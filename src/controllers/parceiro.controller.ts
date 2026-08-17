import type { Context } from "hono";
import { createParceiroSchema, updateParceiroSchema } from "../schemas";
import { parceiroService } from "../services/parceiro.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const parceiroController = {
    async list(c: Context<AppEnv>) {
        return c.json(await parceiroService.listByScope(c.get("db"), scopeOf(c)));
    },

    async getById(c: Context<AppEnv>) {
        const row = await parceiroService.findByIdOwned(c.get("db"), scopeOf(c), c.req.param("id")!);
        if (!row) throw new NotFoundError("Parceiro");
        return c.json(row);
    },

    async create(c: Context<AppEnv>) {
        const body = createParceiroSchema.parse(await c.req.json());
        const created = await parceiroService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(created, 201);
    },

    async update(c: Context<AppEnv>) {
        const body = updateParceiroSchema.parse(await c.req.json());
        const updated = await parceiroService.update(c.get("db"), scopeOf(c), c.req.param("id")!, body, c.get("userId"));
        if (!updated) throw new NotFoundError("Parceiro");
        return c.json(updated);
    },

    async remove(c: Context<AppEnv>) {
        const deleted = await parceiroService.delete(c.get("db"), scopeOf(c), c.req.param("id")!, c.get("userId"));
        if (!deleted) throw new NotFoundError("Parceiro");
        return c.json(deleted);
    },
};
