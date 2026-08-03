import type { Context } from "hono";
import { createOrgSchema } from "../schemas";
import { orgService } from "../services/org.service";
import type { AppEnv } from "../types";

// Rotas sob authGuard (sem orgContext): criar org e listar as minhas.
export const orgController = {
    async createOrg(c: Context<AppEnv>) {
        const body = createOrgSchema.parse(await c.req.json());
        const org = await orgService.create(c.get("db"), c.get("userId"), body);
        return c.json(org, 201);
    },

    async listMine(c: Context<AppEnv>) {
        const orgs = await orgService.listMine(c.get("db"), c.get("userId"));
        return c.json(orgs);
    },
};
