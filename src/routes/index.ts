import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authGuard } from "../middlewares/auth";
import { orgContext, clienteScope } from "../middlewares/orgContext";

import { authRoute } from "./auth.route";
import { userRoute } from "./users.route";
import { accountRoute } from "./account.route";
import { accountTypeRoute } from "./accountType.route";
import { categoryRoute } from "./category.route";
import { goalRoute } from "./goal.route";
import { transactionRoute } from "./transaction.route";
import { extractRoute } from "./extract.route";
import { reportRoute } from "./report.route";

export const routes = new Hono<AppEnv>();

// Rotas públicas (registro/login).
routes.route("/auth", authRoute);

// Rotas protegidas: exigem JWT válido. O authGuard injeta o userId no contexto.
const protectedRoutes = new Hono<AppEnv>();
protectedRoutes.use("*", authGuard);

// Identidade do próprio usuário e lookups globais — não dependem de org/cliente.
protectedRoutes.route("/users", userRoute);
protectedRoutes.route("/account-types", accountTypeRoute);

// Dados financeiros: escopados por organização (X-Org-Id) + cliente (X-Cliente-Id).
// orgContext resolve o membro ativo; clienteScope valida e injeta o clienteId;
// cada rota checa a permissão via requirePermission.
const scoped = new Hono<AppEnv>();
scoped.use("*", orgContext, clienteScope);
scoped.route("/accounts", accountRoute);
scoped.route("/categories", categoryRoute);
scoped.route("/goals", goalRoute);
scoped.route("/transactions", transactionRoute);
scoped.route("/extracts", extractRoute);
scoped.route("/reports", reportRoute);

protectedRoutes.route("/", scoped);

routes.route("/", protectedRoutes);
