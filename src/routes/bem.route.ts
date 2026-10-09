import { Hono } from "hono";
import { bemController } from "../controllers/bem.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Patrimônio do cliente ativo: bens e investimentos. Reusa as permissões financeiras.
export const bemRoute = new Hono<AppEnv>();

bemRoute.get("/", requirePermission("finance:read"), bemController.list);
// Antes de "/:id" para não ser capturado como id.
bemRoute.get("/summary", requirePermission("finance:read"), bemController.summary);
bemRoute.post("/", requirePermission("finance:write"), bemController.create);
bemRoute.get("/:id", requirePermission("finance:read"), bemController.getById);
bemRoute.put("/:id", requirePermission("finance:write"), bemController.update);
bemRoute.delete("/:id", requirePermission("finance:write"), bemController.remove);
