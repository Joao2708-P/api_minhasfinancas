import { Hono } from "hono";
import { contaProgramadaController } from "../controllers/contaProgramada.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Contas a pagar/receber (compromissos futuros). Escopo por cliente ativo.
// Filtro ?direction=payable|receivable & ?status= & ?from=&to= (vencimento).
export const contaProgramadaRoute = new Hono<AppEnv>();

contaProgramadaRoute.get("/", requirePermission("finance:read"), contaProgramadaController.list);
contaProgramadaRoute.post("/", requirePermission("finance:write"), contaProgramadaController.create);
contaProgramadaRoute.get("/:id", requirePermission("finance:read"), contaProgramadaController.getById);
contaProgramadaRoute.put("/:id", requirePermission("finance:write"), contaProgramadaController.update);
// Sugestões de conciliação (transações candidatas) + baixa/conciliação.
contaProgramadaRoute.get("/:id/suggestions", requirePermission("finance:read"), contaProgramadaController.suggestions);
contaProgramadaRoute.post("/:id/settle", requirePermission("finance:write"), contaProgramadaController.settle);
contaProgramadaRoute.delete("/:id", requirePermission("finance:write"), contaProgramadaController.remove);
