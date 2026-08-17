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
import { parceiroRoute } from "./parceiro.route";
import { funcionarioRoute } from "./funcionario.route";
import { socioRoute } from "./socio.route";
import { orgRoute } from "./org.route";
import { membroRoute } from "./membro.route";
import { clienteRoute } from "./cliente.route";
import { papelRoute } from "./papel.route";
import { auditRoute } from "./audit.route";
import { orgSettingsRoute } from "./orgSettings.route";
import { publicRoute } from "./public.route";
import { adminRoute } from "./admin.route";
import { platformRoute } from "./platform.route";
import { portalRoute } from "./portal.route";
import { calculatorRoute } from "./calculator.route";

export const routes = new Hono<AppEnv>();

// Rotas públicas (login + marca white-label por subdomínio).
routes.route("/auth", authRoute);
routes.route("/public", publicRoute);

// Provisionamento: NÃO usa authGuard — é gated pelo ADMIN_TOKEN dentro da rota
// (adminGuard). É como o dono da plataforma cadastra donos enquanto o
// self-service está fechado.
routes.route("/admin", adminRoute);

// Rotas protegidas: exigem JWT válido. O authGuard injeta o userId no contexto.
const protectedRoutes = new Hono<AppEnv>();
protectedRoutes.use("*", authGuard);

// Identidade do próprio usuário e lookups globais — não dependem de org/cliente.
protectedRoutes.route("/users", userRoute);
protectedRoutes.route("/account-types", accountTypeRoute);
// Painel da plataforma (dono da plataforma) — exige JWT + platform_admin (guard
// dentro da rota). Não depende de org/cliente: é um papel acima do tenant.
protectedRoutes.route("/platform", platformRoute);
// Portal do cliente — o clienteId vem do vínculo cliente.usuario_id (portalContext),
// nunca de header. Read-only dos próprios dados. Não passa por orgContext.
protectedRoutes.route("/portal", portalRoute);
// Calculadoras de simulação: cálculo puro (sem org/cliente), só exigem login.
protectedRoutes.route("/calculators", calculatorRoute);
// Criar org / listar minhas orgs — antes de ter uma org ativa (sem orgContext).
protectedRoutes.route("/orgs", orgRoute);

// Escopado por organização (X-Org-Id), SEM cliente: gestão de membros e clientes.
const orgScoped = new Hono<AppEnv>();
orgScoped.use("*", orgContext);
orgScoped.route("/membros", membroRoute);
orgScoped.route("/clientes", clienteRoute);
orgScoped.route("/roles", papelRoute);
orgScoped.route("/audit", auditRoute);
orgScoped.route("/org", orgSettingsRoute);
protectedRoutes.route("/", orgScoped);

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
scoped.route("/partners", parceiroRoute);
scoped.route("/employees", funcionarioRoute);
scoped.route("/shareholders", socioRoute);

protectedRoutes.route("/", scoped);

routes.route("/", protectedRoutes);
