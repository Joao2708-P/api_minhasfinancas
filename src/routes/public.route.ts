import { Hono } from "hono";
import { orgController } from "../controllers/org.controller";
import type { AppEnv } from "../types";

// Rotas públicas (sem auth). Só expõem a marca da org pelo subdomínio,
// para o front pintar a tela de login do cliente (white-label).
export const publicRoute = new Hono<AppEnv>();

publicRoute.get("/branding", orgController.publicBranding);
