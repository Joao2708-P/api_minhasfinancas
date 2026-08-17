import { Hono } from "hono";
import { auditController } from "../controllers/audit.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Trilha de auditoria da org. Visibilidade administrativa → org:manage_members.
export const auditRoute = new Hono<AppEnv>();

auditRoute.get("/", requirePermission("org:manage_members"), auditController.list);
