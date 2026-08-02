import type { Context } from "hono";
import { createAccountSchema, updateAccountSchema } from "../schemas/account.schema";
import { accountService } from "../services/account.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

// org+cliente vêm SEMPRE do contexto (orgContext/clienteScope), nunca do corpo.
const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const accountController = {
    async listAccounts(c: Context<AppEnv>) {
        const accounts = await accountService.listByScope(c.get("db"), scopeOf(c));
        return c.json(accounts);
    },

    async getAccountById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const s = scopeOf(c);

        const acc = await accountService.findByIdOwned(c.get("db"), s, id);
        if (!acc) throw new NotFoundError("Conta");

        const balance = await accountService.currentBalance(c.get("db"), s, acc.id, acc.balance ?? 0);

        return c.json({ ...acc, currentBalance: balance });
    },

    async createAccount(c: Context<AppEnv>) {
        const body = createAccountSchema.parse(await c.req.json());

        const acc = await accountService.create(c.get("db"), scopeOf(c), body);
        return c.json(acc, 201);
    },

    async updateAccount(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateAccountSchema.parse(await c.req.json());
        const s = scopeOf(c);

        const existing = await accountService.findByIdOwned(c.get("db"), s, id);
        if (!existing) throw new NotFoundError("Conta");

        const acc = await accountService.update(c.get("db"), s, id, body);
        return c.json(acc);
    },

    async deleteAccount(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const deleted = await accountService.delete(c.get("db"), scopeOf(c), id);
        if (!deleted) throw new NotFoundError("Conta");

        return c.json(deleted);
    },
};
