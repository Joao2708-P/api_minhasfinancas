import { Hono } from "hono";
import { accountController } from "../controllers/account.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const accountRoute = new Hono<AppEnv>();

accountRoute.get("/", requirePermission("finance:read"), accountController.listAccounts);
accountRoute.post("/", requirePermission("finance:write"), accountController.createAccount);
accountRoute.get("/:id", requirePermission("finance:read"), accountController.getAccountById);
accountRoute.put("/:id", requirePermission("finance:write"), accountController.updateAccount);
accountRoute.delete("/:id", requirePermission("finance:write"), accountController.deleteAccount);
