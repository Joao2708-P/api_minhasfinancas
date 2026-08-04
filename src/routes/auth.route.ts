import { Hono } from "hono";
import { authController } from "../controllers/auth.controller";
import { authGuard } from "../middlewares/auth";
import type { AppEnv } from "../types";

export const authRoute = new Hono<AppEnv>();

// Rota pública: login. O cadastro público está FECHADO — donos
// (investidores/contadores) são criados via POST /admin/provision (ADMIN_TOKEN).
// Quando abrir o self-service (landing page), reintroduzir /register aqui.
authRoute.post("/login", authController.login);

// Rota protegida: dados do usuário logado
authRoute.get("/me", authGuard, authController.me);
