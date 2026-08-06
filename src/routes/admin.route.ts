import { Hono } from "hono";
import { adminController } from "../controllers/admin.controller";
import { adminGuard } from "../middlewares/adminGuard";
import type { AppEnv } from "../types";

export const adminRoute = new Hono<AppEnv>();

// Provisionamento de donos — gated pelo ADMIN_TOKEN (não pelo JWT de usuário).
adminRoute.post("/provision", adminGuard, adminController.provision);
