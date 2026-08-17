import type { Context } from "hono";
import { createPapelSchema, updatePapelSchema } from "../schemas";
import { papelService } from "../services/papel.service";
import type { AppEnv } from "../types";

// Rotas sob orgContext (X-Org-Id), gated por org:manage_members. Gerencia os
// papéis customizados da org (permissões configuráveis).
export const papelController = {
    // Catálogo fixo de chaves de permissão (para a tela montar os checkboxes).
    catalog(c: Context<AppEnv>) {
        return c.json(papelService.catalog());
    },

    async list(c: Context<AppEnv>) {
        const papeis = await papelService.listByOrg(c.get("db"), c.get("organizacaoId"));
        return c.json(papeis);
    },

    async create(c: Context<AppEnv>) {
        const body = createPapelSchema.parse(await c.req.json());
        const created = await papelService.create(c.get("db"), c.get("organizacaoId"), body, c.get("userId"));
        return c.json(created, 201);
    },

    async update(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updatePapelSchema.parse(await c.req.json());
        const updated = await papelService.update(c.get("db"), c.get("organizacaoId"), id, body, c.get("userId"));
        return c.json(updated);
    },

    async remove(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const result = await papelService.remove(c.get("db"), c.get("organizacaoId"), id, c.get("userId"));
        return c.json(result);
    },
};
