import { Hono } from "hono";
import { membroController } from "../controllers/membro.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Gestão de membros — só quem tem org:manage_members (owner/admin).
export const membroRoute = new Hono<AppEnv>();

membroRoute.get("/", requirePermission("org:manage_members"), membroController.listMembros);
membroRoute.post("/", requirePermission("org:manage_members"), membroController.addMembro);
// Convite completo (cria a conta se o e-mail for novo). É o usado pela tela de Equipe.
membroRoute.post("/invite", requirePermission("org:manage_members"), membroController.inviteMembro);
membroRoute.patch("/:id", requirePermission("org:manage_members"), membroController.updateMembro);
