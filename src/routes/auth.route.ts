import { Hono } from "hono";
import { authController } from "../controllers/auth.controller";
import { authGuard } from "../middlewares/auth";
import type { AppEnv } from "../types";

export const authRoute = new Hono<AppEnv>();

// Rotas públicas
authRoute.post("/register", authController.register);
authRoute.post("/login", authController.login);

// Rota protegida: dados do usuário logado
authRoute.get("/me", authGuard, authController.me);
