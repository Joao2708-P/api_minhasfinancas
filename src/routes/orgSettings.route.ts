import { Hono } from "hono";
import { orgController } from "../controllers/org.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

// Configurações da org ativa (X-Org-Id). Branding = white-label.
export const orgSettingsRoute = new Hono<AppEnv>();

orgSettingsRoute.patch("/branding", requirePermission("org:branding"), orgController.updateBranding);
