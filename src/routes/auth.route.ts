import { Hono } from "hono";
import { authController } from "../controllers/auth.controller";
import { authGuard } from "../middlewares/auth";
import type { AppEnv } from "../types";

export const authRoute = new Hono<AppEnv>();

// Rota pública: login. O cadastro público está FECHADO — donos
// (investidores/contadores) são criados via POST /admin/provision (ADMIN_TOKEN).
// Quando abrir o self-service (landing page), reintroduzir /register aqui.
authRoute.post("/login", authController.login);

// Primeiro acesso + recuperação de senha (mesmo primitivo, público), em 2 etapas:
// forgot emite o código; verify-code valida (sem consumir); reset troca a senha e autentica.
authRoute.post("/forgot", authController.forgot);
authRoute.post("/verify-code", authController.verifyCode);
authRoute.post("/reset", authController.reset);

// Rota protegida: dados do usuário logado
authRoute.get("/me", authGuard, authController.me);
