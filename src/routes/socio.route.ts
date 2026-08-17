import { Hono } from "hono";
import { socioController } from "../controllers/socio.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const socioRoute = new Hono<AppEnv>();

socioRoute.get("/", requirePermission("finance:read"), socioController.list);
socioRoute.post("/", requirePermission("finance:write"), socioController.create);
socioRoute.get("/:id", requirePermission("finance:read"), socioController.getById);
socioRoute.put("/:id", requirePermission("finance:write"), socioController.update);
socioRoute.delete("/:id", requirePermission("finance:write"), socioController.remove);
