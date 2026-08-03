import { Hono } from "hono";
import { clienteController } from "../controllers/cliente.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Gestão de clientes da org (escopado por org, não por cliente).
export const clienteRoute = new Hono<AppEnv>();

clienteRoute.get("/", requirePermission("client:read"), clienteController.listClientes);
clienteRoute.post("/", requirePermission("client:create"), clienteController.createCliente);
clienteRoute.get("/:id", requirePermission("client:read"), clienteController.getClienteById);
