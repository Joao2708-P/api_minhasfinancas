import { Hono } from "hono";
import { extractController } from "../controllers/extract.controller";
import type { AppEnv } from "../types";

export const extractRoute = new Hono<AppEnv>();

extractRoute.get("/", extractController.listExtracts);
extractRoute.post("/", extractController.uploadExtract);
extractRoute.get("/:id", extractController.getExtractById);
extractRoute.post("/:id/import", extractController.importExtract);
extractRoute.delete("/:id", extractController.deleteExtract);
