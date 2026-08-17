import type { Context } from "hono";
import { createSocioSchema, updateSocioSchema } from "../schemas";
import { socioService } from "../services/socio.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const socioController = {
    async list(c: Context<AppEnv>) {
        return c.json(await socioService.listByScope(c.get("db"), scopeOf(c)));
    },

    async getById(c: Context<AppEnv>) {
        const row = await socioService.findByIdOwned(c.get("db"), scopeOf(c), c.req.param("id")!);
        if (!row) throw new NotFoundError("Sócio");
        return c.json(row);
    },

    async create(c: Context<AppEnv>) {
        const body = createSocioSchema.parse(await c.req.json());
        const created = await socioService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(created, 201);
    },

    async update(c: Context<AppEnv>) {
        const body = updateSocioSchema.parse(await c.req.json());
        const updated = await socioService.update(c.get("db"), scopeOf(c), c.req.param("id")!, body, c.get("userId"));
        if (!updated) throw new NotFoundError("Sócio");
        return c.json(updated);
    },

    async remove(c: Context<AppEnv>) {
        const deleted = await socioService.delete(c.get("db"), scopeOf(c), c.req.param("id")!, c.get("userId"));
        if (!deleted) throw new NotFoundError("Sócio");
        return c.json(deleted);
    },
};
