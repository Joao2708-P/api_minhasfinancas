import { Hono } from "hono";
import { authController } from "../controllers/auth.controller";
import { authGuard } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import type { AppEnv } from "../types";

export const authRoute = new Hono<AppEnv>();

// Rota pública: login. O cadastro público está FECHADO — donos
// (investidores/contadores) são criados via POST /admin/provision (ADMIN_TOKEN).
// Quando abrir o self-service (landing page), reintroduzir /register aqui.
// Rate limit (RL_LOGIN) freia força-bruta de senha.
authRoute.post("/login", rateLimit((env) => env.RL_LOGIN), authController.login);

// Primeiro acesso + recuperação de senha (mesmo primitivo, público), em 2 etapas:
// forgot emite o código; verify-code valida (sem consumir); reset troca a senha e autentica.
// O código tem só 6 dígitos → verify-code/reset são o alvo mais sensível de força-bruta;
// RL_CODE cobre todo o fluxo do código.
authRoute.post("/forgot", rateLimit((env) => env.RL_CODE), authController.forgot);
authRoute.post("/verify-code", rateLimit((env) => env.RL_CODE), authController.verifyCode);
authRoute.post("/reset", rateLimit((env) => env.RL_CODE), authController.reset);

// Encerra a sessão: limpa o cookie de autenticação. Público (só apaga o cookie).
authRoute.post("/logout", authController.logout);

// Rota protegida: dados do usuário logado
authRoute.get("/me", authGuard, authController.me);
