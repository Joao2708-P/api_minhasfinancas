import { Hono } from "hono";
import { papelController } from "../controllers/papel.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Papéis customizados da org (permissões configuráveis). Gerenciar papel é decidir
// quem-pode-o-quê → gated pela mesma permissão de gestão de membros.
export const papelRoute = new Hono<AppEnv>();

papelRoute.get("/catalog", requirePermission("org:manage_members"), papelController.catalog);
papelRoute.get("/", requirePermission("org:manage_members"), papelController.list);
papelRoute.post("/", requirePermission("org:manage_members"), papelController.create);
papelRoute.patch("/:id", requirePermission("org:manage_members"), papelController.update);
papelRoute.delete("/:id", requirePermission("org:manage_members"), papelController.remove);
