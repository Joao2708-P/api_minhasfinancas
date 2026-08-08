import { Hono } from "hono";
import { platformController } from "../controllers/platform.controller";
import { platformAdminGuard } from "../middlewares/platformAdminGuard";
import type { AppEnv } from "../types";

// Painel da plataforma — todas as rotas exigem platform_admin.
// (O authGuard já roda antes, no grupo protegido do index.)
export const platformRoute = new Hono<AppEnv>();

platformRoute.use("*", platformAdminGuard);

platformRoute.get("/orgs", platformController.listOrgs);
platformRoute.post("/orgs", platformController.provisionOrg);
platformRoute.patch("/orgs/:id/billing", platformController.setBilling);
