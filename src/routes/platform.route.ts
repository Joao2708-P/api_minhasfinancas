import { Hono } from "hono";
import { platformController } from "../controllers/platform.controller";
import { ingestKeyController } from "../controllers/ingestKey.controller";
import { platformAdminGuard } from "../middlewares/platformAdminGuard";
import type { AppEnv } from "../types";

// Painel da plataforma — todas as rotas exigem platform_admin.
// (O authGuard já roda antes, no grupo protegido do index.)
export const platformRoute = new Hono<AppEnv>();

platformRoute.use("*", platformAdminGuard);

platformRoute.get("/orgs", platformController.listOrgs);
platformRoute.post("/orgs", platformController.provisionOrg);
platformRoute.patch("/orgs/:id/billing", platformController.setBilling);

// Integração com contas reais (API externa): só o dono da plataforma conecta.
// Gera/lista/revoga a chave de ingestão de um cliente de uma org.
platformRoute.get("/orgs/:orgId/clientes", ingestKeyController.listClientes);
platformRoute.get("/orgs/:orgId/clientes/:clienteId/ingest-keys", ingestKeyController.list);
platformRoute.post("/orgs/:orgId/clientes/:clienteId/ingest-keys", ingestKeyController.create);
platformRoute.delete("/orgs/:orgId/clientes/:clienteId/ingest-keys/:id", ingestKeyController.revoke);
