import type { Context } from "hono";
import { createAccountSchema, updateAccountSchema } from "../schemas/account.schema";
import { accountService } from "../services/account.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv } from "../types";

export const accountController = {
    async listAccounts(c: Context<AppEnv>) {
        const accounts = await accountService.listByUser(c.get("db"), c.get("userId"));
        return c.json(accounts);
    },

    async getAccountById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const acc = await accountService.findByIdOwned(c.get("db"), c.get("userId"), id);
        if (!acc) throw new NotFoundError("Conta");

        const balance = await accountService.currentBalance(c.get("db"), acc.id, acc.balance ?? 0);

        return c.json({ ...acc, currentBalance: balance });
    },

    async createAccount(c: Context<AppEnv>) {
        const body = createAccountSchema.parse(await c.req.json());

        const acc = await accountService.create(c.get("db"), c.get("userId"), body);
        return c.json(acc, 201);
    },

    async updateAccount(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateAccountSchema.parse(await c.req.json());

        const existing = await accountService.findByIdOwned(c.get("db"), c.get("userId"), id);
        if (!existing) throw new NotFoundError("Conta");

        const acc = await accountService.update(c.get("db"), c.get("userId"), id, body);
        return c.json(acc);
    },

    async deleteAccount(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const deleted = await accountService.delete(c.get("db"), c.get("userId"), id);
        if (!deleted) throw new NotFoundError("Conta");

        return c.json(deleted);
    },
};
