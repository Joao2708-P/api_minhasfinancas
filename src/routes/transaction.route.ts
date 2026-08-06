import { Hono } from "hono";
import { transactionController } from "../controllers/transaction.controller";
import { requirePermission } from "../middlewares/orgContext";
import type { AppEnv } from "../types";

export const transactionRoute = new Hono<AppEnv>();

transactionRoute.get("/", requirePermission("finance:read"), transactionController.listTransactions);
transactionRoute.post("/", requirePermission("finance:write"), transactionController.createTransaction);
transactionRoute.get("/:id", requirePermission("finance:read"), transactionController.getTransactionById);
transactionRoute.put("/:id", requirePermission("finance:write"), transactionController.updateTransaction);
transactionRoute.delete("/:id", requirePermission("finance:write"), transactionController.deleteTransaction);
