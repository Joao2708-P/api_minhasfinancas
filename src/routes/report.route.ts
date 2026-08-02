import { Hono } from "hono";
import { reportController } from "../controllers/report.controller";
import type { AppEnv } from "../types";

export const reportRoute = new Hono<AppEnv>();

reportRoute.get("/summary", reportController.summary);
reportRoute.get("/by-category", reportController.byCategory);
reportRoute.get("/by-account", reportController.byAccount);
reportRoute.get("/cashflow", reportController.cashflow);
reportRoute.get("/goals", reportController.goals);
