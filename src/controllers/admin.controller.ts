import type { Context } from "hono";
import { provisionOwnerSchema, provisionPlatformAdminSchema } from "../schemas/admin.schema";
import { adminService } from "../services/admin.service";
import type { AppEnv } from "../types";

export const adminController = {
    // POST /admin/provision — cria um dono + a organização dele.
    // Protegido pelo adminGuard (ADMIN_TOKEN), não pelo authGuard.
    async provision(c: Context<AppEnv>) {
        const body = provisionOwnerSchema.parse(await c.req.json());

        const result = await adminService.provisionOwner(c.get("db"), body);

        return c.json(result, 201);
    },

    // POST /admin/platform-admin — bootstrap do administrador da plataforma (você).
    // Também gated pelo ADMIN_TOKEN. É como o primeiro platform_admin nasce.
    async provisionPlatformAdmin(c: Context<AppEnv>) {
        const body = provisionPlatformAdminSchema.parse(await c.req.json());

        const result = await adminService.provisionPlatformAdmin(c.get("db"), body);

        return c.json(result, 201);
    },
};
