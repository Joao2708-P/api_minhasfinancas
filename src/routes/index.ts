import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authGuard } from "../middlewares/auth";

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

protectedRoutes.route("/users", userRoute);
protectedRoutes.route("/accounts", accountRoute);
protectedRoutes.route("/account-types", accountTypeRoute);
protectedRoutes.route("/categories", categoryRoute);
protectedRoutes.route("/goals", goalRoute);
protectedRoutes.route("/transactions", transactionRoute);
protectedRoutes.route("/extracts", extractRoute);
protectedRoutes.route("/reports", reportRoute);

routes.route("/", protectedRoutes);
