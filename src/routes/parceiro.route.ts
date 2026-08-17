import { Hono } from "hono";
import { parceiroController } from "../controllers/parceiro.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const parceiroRoute = new Hono<AppEnv>();

parceiroRoute.get("/", requirePermission("finance:read"), parceiroController.list);
parceiroRoute.post("/", requirePermission("finance:write"), parceiroController.create);
parceiroRoute.get("/:id", requirePermission("finance:read"), parceiroController.getById);
parceiroRoute.put("/:id", requirePermission("finance:write"), parceiroController.update);
parceiroRoute.delete("/:id", requirePermission("finance:write"), parceiroController.remove);
