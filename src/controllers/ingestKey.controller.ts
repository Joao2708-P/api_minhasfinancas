import type { Context } from "hono";
import { asc, eq } from "drizzle-orm";
import { createIngestKeySchema } from "../schemas";
import { ingestKeyService } from "../services/ingestKey.service";
import { cliente } from "../database/schema";
import { NotFoundError } from "../errors/errors";
import { assertClienteNaOrg } from "../lib/tenant";
import type { AppEnv, Scope } from "../types";

// A conexão com contas reais (API externa/agregador) é feita pelo DONO DA PLATAFORMA,
// não pelo escritório nem pelo cliente. Por isso estas rotas ficam em /platform
// (platformAdminGuard) e o escopo org+cliente vem da URL — validado: o cliente
// precisa pertencer à org informada.
async function scopeOf(c: Context<AppEnv>): Promise<Scope> {
    const orgId = c.req.param("orgId")!;
    const clienteId = c.req.param("clienteId")!;
    await assertClienteNaOrg(c.get("db"), orgId, clienteId);
    return { orgId, clienteId };
}

export const ingestKeyController = {
    // Clientes de uma org, para o admin escolher qual conectar.
    async listClientes(c: Context<AppEnv>) {
        const rows = await c.get("db").query.cliente.findMany({
            columns: { id: true, name: true, status: true },
            where: eq(cliente.organizacao_id, c.req.param("orgId")!),
            orderBy: [asc(cliente.name)],
        });
        return c.json(rows);
    },

    async list(c: Context<AppEnv>) {
        return c.json(await ingestKeyService.listByScope(c.get("db"), await scopeOf(c)));
    },

    async create(c: Context<AppEnv>) {
        const s = await scopeOf(c);
        const body = createIngestKeySchema.parse(await c.req.json());
        const created = await ingestKeyService.create(c.get("db"), s, body, c.get("userId"));
        return c.json(created, 201);
    },

    async revoke(c: Context<AppEnv>) {
        const s = await scopeOf(c);
        const revoked = await ingestKeyService.revoke(c.get("db"), s, c.req.param("id")!, c.get("userId"));
        if (!revoked) throw new NotFoundError("Chave de ingestão");
        return c.json(revoked);
    },
};
