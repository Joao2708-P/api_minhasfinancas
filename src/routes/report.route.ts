import { Hono } from "hono";
import { reportController } from "../controllers/report.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const reportRoute = new Hono<AppEnv>();

reportRoute.get("/summary", requirePermission("report:read"), reportController.summary);
reportRoute.get("/by-category", requirePermission("report:read"), reportController.byCategory);
reportRoute.get("/by-account", requirePermission("report:read"), reportController.byAccount);
reportRoute.get("/cashflow", requirePermission("report:read"), reportController.cashflow);
reportRoute.get("/goals", requirePermission("report:read"), reportController.goals);
