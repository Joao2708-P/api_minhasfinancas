import type { Context } from "hono";
import { createTransactionSchema, updateTransactionSchema } from "../schemas/transaction.schema";
import { transactionService, type TransactionFilters } from "../services/transaction.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

// Lê filtros opcionais da query string (?account_id=..&type=in&from=..&to=..).
function parseFilters(c: Context<AppEnv>): TransactionFilters {
    const filters: TransactionFilters = {};

    const accountId = c.req.query("account_id");
    const categoryId = c.req.query("category_id");
    const type = c.req.query("type");
    const from = c.req.query("from");
    const to = c.req.query("to");

    if (accountId) filters.account_id = accountId;
    if (categoryId) filters.category_id = categoryId;
    if (type === "in" || type === "out") filters.type = type;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    const limit = Number(c.req.query("limit"));
    const offset = Number(c.req.query("offset"));
    if (Number.isInteger(limit) && limit > 0) filters.limit = limit;
    if (Number.isInteger(offset) && offset > 0) filters.offset = offset;

    return filters;
}

export const transactionController = {
    async listTransactions(c: Context<AppEnv>) {
        const txs = await transactionService.listByScope(c.get("db"), scopeOf(c), parseFilters(c));
        return c.json(txs);
    },

    async getTransactionById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const tx = await transactionService.findByIdOwned(c.get("db"), scopeOf(c), id);
        if (!tx) throw new NotFoundError("Transação");

        return c.json(tx);
    },

    async createTransaction(c: Context<AppEnv>) {
        const body = createTransactionSchema.parse(await c.req.json());

        const tx = await transactionService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(tx, 201);
    },

    async updateTransaction(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateTransactionSchema.parse(await c.req.json());

        const tx = await transactionService.update(c.get("db"), scopeOf(c), id, body, c.get("userId"));
        return c.json(tx);
    },

    async deleteTransaction(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const deleted = await transactionService.delete(c.get("db"), scopeOf(c), id, c.get("userId"));
        if (!deleted) throw new NotFoundError("Transação");

        return c.json(deleted);
    },
};
