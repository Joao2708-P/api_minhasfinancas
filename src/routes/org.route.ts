import { Hono } from "hono";
import { orgController } from "../controllers/org.controller";
import type { AppEnv } from "../types";

// Só authGuard: criar org e listar as minhas não dependem de já ser membro.
export const orgRoute = new Hono<AppEnv>();

orgRoute.post("/", orgController.createOrg);
orgRoute.get("/", orgController.listMine);
