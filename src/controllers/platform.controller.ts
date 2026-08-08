import type { Context } from "hono";
import { setBillingSchema } from "../schemas/platform.schema";
import { provisionOwnerSchema } from "../schemas/admin.schema";
import { platformService } from "../services/platform.service";
import { adminService } from "../services/admin.service";
import type { AppEnv } from "../types";

// Painel da plataforma (o dono da plataforma — você). Protegido por authGuard +
// platformAdminGuard: o usuário precisa ter platform_admin = true.
export const platformController = {
    async listOrgs(c: Context<AppEnv>) {
        const orgs = await platformService.listOrgs(c.get("db"));
        return c.json(orgs);
    },

    async setBilling(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = setBillingSchema.parse(await c.req.json());
        const updated = await platformService.setBilling(c.get("db"), id, body);
        return c.json(updated);
    },

    // Provisiona um novo cliente da plataforma (dono + org). Mesmo caminho do
    // /admin/provision, mas autenticado pelo JWT do platform_admin (não pelo
    // ADMIN_TOKEN cru). Devolve o firstAccessCode (fallback quando o e-mail real
    // ainda não está ligado).
    async provisionOrg(c: Context<AppEnv>) {
        const body = provisionOwnerSchema.parse(await c.req.json());
        const result = await adminService.provisionOwner(c.get("db"), body);
        return c.json(result, 201);
    },
};
