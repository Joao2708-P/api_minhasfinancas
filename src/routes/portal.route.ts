import { Hono } from "hono";
import type { AppEnv } from "../types";
import { portalContext } from "../middlewares/portalContext";
import { portalController } from "../controllers/portal.controller";
import { accountController } from "../controllers/account.controller";
import { categoryController } from "../controllers/category.controller";
import { transactionController } from "../controllers/transaction.controller";
import { goalController } from "../controllers/goal.controller";
import { extractController } from "../controllers/extract.controller";
import { reportController } from "../controllers/report.controller";

// Portal do cliente — a MESMA dashboard, escopada ao próprio cliente. O portalContext
// deriva organizacaoId/clienteId do vínculo cliente.usuario_id=userId (NUNCA de header),
// então reusamos os controllers financeiros existentes (todos leem só {orgId, clienteId}
// do contexto — verificado: nenhum lê `membro`). Sem requirePermission: o portal é sua
// própria fronteira; o escopo ao próprio cliente é garantido pelo portalContext + services.
export const portalRoute = new Hono<AppEnv>();

portalRoute.use("*", portalContext);

portalRoute.get("/me", portalController.me);

// Contas
portalRoute.get("/accounts", accountController.listAccounts);
portalRoute.post("/accounts", accountController.createAccount);
portalRoute.get("/accounts/:id", accountController.getAccountById);
portalRoute.put("/accounts/:id", accountController.updateAccount);
portalRoute.delete("/accounts/:id", accountController.deleteAccount);

// Categorias
portalRoute.get("/categories", categoryController.listCategories);
portalRoute.post("/categories", categoryController.createCategory);
portalRoute.delete("/categories/:id", categoryController.deleteCategory);

// Transações
portalRoute.get("/transactions", transactionController.listTransactions);
portalRoute.post("/transactions", transactionController.createTransaction);
portalRoute.delete("/transactions/:id", transactionController.deleteTransaction);

// Metas
portalRoute.get("/goals", goalController.listGoals);
portalRoute.post("/goals", goalController.createGoal);
portalRoute.delete("/goals/:id", goalController.deleteGoal);

// Extratos (upload, listar, importar, excluir)
portalRoute.post("/extracts", extractController.uploadExtract);
portalRoute.get("/extracts", extractController.listExtracts);
portalRoute.post("/extracts/:id/import", extractController.importExtract);
portalRoute.delete("/extracts/:id", extractController.deleteExtract);

// Relatórios
portalRoute.get("/reports/summary", reportController.summary);
portalRoute.get("/reports/by-category", reportController.byCategory);
portalRoute.get("/reports/by-account", reportController.byAccount);
portalRoute.get("/reports/cashflow", reportController.cashflow);
portalRoute.get("/reports/goals", reportController.goals);
