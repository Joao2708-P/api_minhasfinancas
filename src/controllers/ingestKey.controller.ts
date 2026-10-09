import type { Context } from "hono";
import { createIngestKeySchema } from "../schemas";
import { ingestKeyService } from "../services/ingestKey.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const ingestKeyController = {
    async list(c: Context<AppEnv>) {
        return c.json(await ingestKeyService.listByScope(c.get("db"), scopeOf(c)));
    },

    async create(c: Context<AppEnv>) {
        const body = createIngestKeySchema.parse(await c.req.json());
        const created = await ingestKeyService.create(c.get("db"), scopeOf(c), body, c.get("userId"));
        return c.json(created, 201);
    },

    async revoke(c: Context<AppEnv>) {
        const revoked = await ingestKeyService.revoke(c.get("db"), scopeOf(c), c.req.param("id")!, c.get("userId"));
        if (!revoked) throw new NotFoundError("Chave de ingestão");
        return c.json(revoked);
    },
};
