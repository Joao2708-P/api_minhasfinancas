import type { Context } from "hono";
import { createMembroSchema, updateMembroSchema } from "../schemas";
import { membroService } from "../services/membro.service";
import type { AppEnv } from "../types";

// Rotas sob orgContext: a org vem de X-Org-Id (c.get("organizacaoId")).
export const membroController = {
    async listMembros(c: Context<AppEnv>) {
        const membros = await membroService.listByOrg(c.get("db"), c.get("organizacaoId"));
        return c.json(membros);
    },

    async addMembro(c: Context<AppEnv>) {
        const body = createMembroSchema.parse(await c.req.json());
        const created = await membroService.addByEmail(c.get("db"), c.get("organizacaoId"), body);
        return c.json(created, 201);
    },

    async updateMembro(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateMembroSchema.parse(await c.req.json());
        const updated = await membroService.update(c.get("db"), c.get("organizacaoId"), id, body);
        return c.json(updated);
    },
};
