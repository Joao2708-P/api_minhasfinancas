import { Hono } from "hono";
import { ingestController } from "../controllers/ingest.controller";
import { ingestGuard } from "../middlewares/ingestGuard";
import type { AppEnv } from "../types";

// Ingestão de dados de contas reais via API. NÃO usa authGuard (JWT): é chamada
// server-to-server pelo agregador/job, autenticada pela chave por cliente
// (ingestGuard). Montada no topo (fora das rotas protegidas), como /auth e /admin.
export const ingestRoute = new Hono<AppEnv>();

ingestRoute.use("*", ingestGuard);
ingestRoute.post("/sync", ingestController.sync);
