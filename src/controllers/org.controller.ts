import type { Context } from "hono";
import { createOrgSchema, updateBrandingSchema } from "../schemas";
import { orgService } from "../services/org.service";
import { BadRequestError, NotFoundError } from "../errors/errors";
import type { AppEnv } from "../types";

export const orgController = {
    // Sob authGuard (sem orgContext): criar org e listar as minhas.
    async createOrg(c: Context<AppEnv>) {
        const body = createOrgSchema.parse(await c.req.json());
        const org = await orgService.create(c.get("db"), c.get("userId"), body);
        return c.json(org, 201);
    },

    async listMine(c: Context<AppEnv>) {
        const orgs = await orgService.listMine(c.get("db"), c.get("userId"));
        return c.json(orgs);
    },

    // Sob orgContext + org:branding — atualiza a marca da org ativa.
    async updateBranding(c: Context<AppEnv>) {
        const body = updateBrandingSchema.parse(await c.req.json());
        const org = await orgService.updateBranding(c.get("db"), c.get("organizacaoId"), body, c.get("userId"));
        return c.json(org);
    },

    // Público (sem auth): marca da org pelo subdomínio, p/ pintar o login do cliente.
    async publicBranding(c: Context<AppEnv>) {
        const subdomain = c.req.query("subdomain");
        if (!subdomain) throw new BadRequestError("subdomain é obrigatório");

        const org = await orgService.findBySubdomain(c.get("db"), subdomain);
        if (!org) throw new NotFoundError("Organização");

        // Só expõe campos de marca — nada sensível.
        return c.json({
            brand_name: org.brand_name ?? org.name,
            logo_key: org.logo_key,
            primary_color: org.primary_color,
            subdomain: org.subdomain,
        });
    },
};
