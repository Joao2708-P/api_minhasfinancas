import { Hono } from "hono";
import { ingestKeyController } from "../controllers/ingestKey.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Gestão das chaves de ingestão do cliente ativo (org+cliente do contexto).
// Escopo por cliente (montado sob orgContext + clienteScope). Sob finance:write —
// a chave dá acesso de escrita de dados financeiros, então quem gere é quem escreve.
export const ingestKeyRoute = new Hono<AppEnv>();

ingestKeyRoute.get("/", requirePermission("finance:read"), ingestKeyController.list);
ingestKeyRoute.post("/", requirePermission("finance:write"), ingestKeyController.create);
ingestKeyRoute.delete("/:id", requirePermission("finance:write"), ingestKeyController.revoke);
