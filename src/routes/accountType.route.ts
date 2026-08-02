import { Hono } from "hono";
import { accountTypeController } from "../controllers/accountType.controller";
import type { AppEnv } from "../types";

export const accountTypeRoute = new Hono<AppEnv>()

accountTypeRoute.get('/', accountTypeController.listAccountTypes);
accountTypeRoute.post('/', accountTypeController.createAccountType);
accountTypeRoute.get('/:id', accountTypeController.getAccountTypeById);
accountTypeRoute.put('/:id', accountTypeController.updateAccountType);
accountTypeRoute.delete('/:id', accountTypeController.deleteAccountType);
