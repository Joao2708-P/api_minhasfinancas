import type { Context } from "hono";
import { createMembroSchema, updateMembroSchema, inviteMembroSchema } from "../schemas";
import { membroService } from "../services/membro.service";
import { emailConfigFromEnv } from "../lib/email";
import type { AppEnv } from "../types";

// Rotas sob orgContext: a org vem de X-Org-Id (c.get("organizacaoId")).
export const membroController = {
    async listMembros(c: Context<AppEnv>) {
        const membros = await membroService.listByOrg(c.get("db"), c.get("organizacaoId"));
        return c.json(membros);
    },

    async addMembro(c: Context<AppEnv>) {
        const body = createMembroSchema.parse(await c.req.json());
        const created = await membroService.addByEmail(c.get("db"), c.get("organizacaoId"), body, c.get("userId"));
        return c.json(created, 201);
    },

    // Convida/adiciona um membro (cria a conta se o e-mail for novo). Devolve a
    // senha/credenciais para repasse quando cria um usuário novo.
    async inviteMembro(c: Context<AppEnv>) {
        const body = inviteMembroSchema.parse(await c.req.json());
        const result = await membroService.invite(
            c.get("db"),
            c.get("organizacaoId"),
            body,
            c.get("userId"),
            emailConfigFromEnv(c.env),
        );
        return c.json(result, 201);
    },

    async updateMembro(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateMembroSchema.parse(await c.req.json());
        const updated = await membroService.update(
            c.get("db"),
            c.get("organizacaoId"),
            id,
            body,
            c.get("userId"),
            c.get("membro").role,
        );
        return c.json(updated);
    },
};
