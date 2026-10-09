import type { Context } from "hono";
import { createBemSchema, updateBemSchema } from "../schemas";
import { bemService } from "../services/bem.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const bemController = {
    async list(c: Context<AppEnv>) {
        return c.json(await bemService.listByScope(c.get("db"), scopeOf(c)));
    },

    async summary(c: Context<AppEnv>) {
        return c.json(await bemService.summary(c.get("db"), scopeOf(c)));
    },

    async getById(c: Context<AppEnv>) {
        const row = await bemService.findByIdOwned(c.get("db"), scopeOf(c), c.req.param("id")!);
        if (!row) throw new NotFoundError("Bem");
        return c.json(row);
    },

    async create(c: Context<AppEnv>) {
        const body = createBemSchema.parse(await c.req.json());
        const created = await bemService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(created, 201);
    },

    async update(c: Context<AppEnv>) {
        const body = updateBemSchema.parse(await c.req.json());
        const updated = await bemService.update(c.get("db"), scopeOf(c), c.req.param("id")!, body, c.get("userId"));
        return c.json(updated);
    },

    async remove(c: Context<AppEnv>) {
        const deleted = await bemService.delete(c.get("db"), scopeOf(c), c.req.param("id")!, c.get("userId"));
        if (!deleted) throw new NotFoundError("Bem");
        return c.json(deleted);
    },
};
