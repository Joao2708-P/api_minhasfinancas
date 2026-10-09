import type { Context } from "hono";
import { ingestSyncSchema } from "../schemas";
import { ingestService } from "../services/ingest.service";
import type { AppEnv, Scope } from "../types";

// org+cliente vêm do ingestGuard (via chave), nunca do corpo.
const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

export const ingestController = {
    async sync(c: Context<AppEnv>) {
        const body = ingestSyncSchema.parse(await c.req.json());
        const result = await ingestService.sync(c.get("db"), scopeOf(c), body);
        return c.json(result, 201);
    },
};
