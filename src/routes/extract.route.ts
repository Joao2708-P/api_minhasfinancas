import { Hono } from "hono";
import { extractController } from "../controllers/extract.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const extractRoute = new Hono<AppEnv>();

extractRoute.get("/", requirePermission("finance:read"), extractController.listExtracts);
extractRoute.post("/", requirePermission("finance:import"), extractController.uploadExtract);
extractRoute.get("/:id", requirePermission("finance:read"), extractController.getExtractById);
extractRoute.post("/:id/import", requirePermission("finance:import"), extractController.importExtract);
extractRoute.delete("/:id", requirePermission("finance:write"), extractController.deleteExtract);
