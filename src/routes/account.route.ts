import { Hono } from "hono";
import { accountController } from "../controllers/account.controller";
import type { AppEnv } from "../types";

export const accountRoute = new Hono<AppEnv>();

accountRoute.get("/", accountController.listAccounts);
accountRoute.post("/", accountController.createAccount);
accountRoute.get("/:id", accountController.getAccountById);
accountRoute.put("/:id", accountController.updateAccount);
accountRoute.delete("/:id", accountController.deleteAccount);
