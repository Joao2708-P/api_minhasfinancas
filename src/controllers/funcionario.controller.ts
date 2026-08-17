import type { Context } from "hono";
import { createFuncionarioSchema, updateFuncionarioSchema } from "../schemas";
import { funcionarioService } from "../services/funcionario.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const funcionarioController = {
    async list(c: Context<AppEnv>) {
        return c.json(await funcionarioService.listByScope(c.get("db"), scopeOf(c)));
    },

    async getById(c: Context<AppEnv>) {
        const row = await funcionarioService.findByIdOwned(c.get("db"), scopeOf(c), c.req.param("id")!);
        if (!row) throw new NotFoundError("Funcionário");
        return c.json(row);
    },

    async create(c: Context<AppEnv>) {
        const body = createFuncionarioSchema.parse(await c.req.json());
        const created = await funcionarioService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(created, 201);
    },

    async update(c: Context<AppEnv>) {
        const body = updateFuncionarioSchema.parse(await c.req.json());
        const updated = await funcionarioService.update(c.get("db"), scopeOf(c), c.req.param("id")!, body, c.get("userId"));
        if (!updated) throw new NotFoundError("Funcionário");
        return c.json(updated);
    },

    async remove(c: Context<AppEnv>) {
        const deleted = await funcionarioService.delete(c.get("db"), scopeOf(c), c.req.param("id")!, c.get("userId"));
        if (!deleted) throw new NotFoundError("Funcionário");
        return c.json(deleted);
    },
};
