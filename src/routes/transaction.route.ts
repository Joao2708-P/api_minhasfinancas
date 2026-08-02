import { Hono } from "hono";
import { transactionController } from "../controllers/transaction.controller";
import type { AppEnv } from "../types";

export const transactionRoute = new Hono<AppEnv>();

transactionRoute.get("/", transactionController.listTransactions);
transactionRoute.post("/", transactionController.createTransaction);
transactionRoute.get("/:id", transactionController.getTransactionById);
transactionRoute.put("/:id", transactionController.updateTransaction);
transactionRoute.delete("/:id", transactionController.deleteTransaction);
