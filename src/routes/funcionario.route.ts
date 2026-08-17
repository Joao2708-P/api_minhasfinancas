import { Hono } from "hono";
import { funcionarioController } from "../controllers/funcionario.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const funcionarioRoute = new Hono<AppEnv>();

funcionarioRoute.get("/", requirePermission("finance:read"), funcionarioController.list);
funcionarioRoute.post("/", requirePermission("finance:write"), funcionarioController.create);
funcionarioRoute.get("/:id", requirePermission("finance:read"), funcionarioController.getById);
funcionarioRoute.put("/:id", requirePermission("finance:write"), funcionarioController.update);
funcionarioRoute.delete("/:id", requirePermission("finance:write"), funcionarioController.remove);
