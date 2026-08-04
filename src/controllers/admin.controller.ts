import type { Context } from "hono";
import { provisionOwnerSchema } from "../schemas/admin.schema";
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
};
