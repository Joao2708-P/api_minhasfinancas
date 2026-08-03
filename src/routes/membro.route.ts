import { Hono } from "hono";
import { membroController } from "../controllers/membro.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Gestão de membros — só quem tem org:manage_members (owner/admin).
export const membroRoute = new Hono<AppEnv>();

membroRoute.get("/", requirePermission("org:manage_members"), membroController.listMembros);
membroRoute.post("/", requirePermission("org:manage_members"), membroController.addMembro);
membroRoute.patch("/:id", requirePermission("org:manage_members"), membroController.updateMembro);
