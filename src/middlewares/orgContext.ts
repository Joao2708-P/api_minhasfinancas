import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { membro as membroTable } from "../database/schema";
import { BadRequestError, ForbiddenError } from "../errors/errors";
import { can, type Permission } from "../lib/permissions";
import { assertClienteNaOrg, assertMembroPodeAcessarCliente } from "../lib/tenant";

// Resolve a organização ativa (header X-Org-Id) e carrega o membro ativo.
// O status é lido a CADA request → revogar (status='revoked') bloqueia na hora,
// independente do TTL do JWT.
export const orgContext: MiddlewareHandler<AppEnv> = async (c, next) => {
    const orgId = c.req.header("X-Org-Id");
    if (!orgId) throw new BadRequestError("Cabeçalho X-Org-Id ausente");

    const db = c.get("db");
    const m = await db.query.membro.findFirst({
        where: and(
            eq(membroTable.organizacao_id, orgId),
            eq(membroTable.user_id, c.get("userId")),
            eq(membroTable.status, "active"),
        ),
    });
    if (!m) throw new ForbiddenError("Você não é membro ativo desta organização");

    c.set("organizacaoId", orgId);
    c.set("membro", { id: m.id, role: m.role, user_id: m.user_id });

    await next();
};

// Bloqueia com 403 quem não tem a permissão (checa permissão, não papel).
export function requirePermission(perm: Permission): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        if (!can(c.get("membro").role, perm)) {
            throw new ForbiddenError("Permissão insuficiente");
        }
        await next();
    };
}

// Resolve o cliente ativo (header X-Cliente-Id): valida que é da org e que o
// membro pode acessá-lo (planner → só os seus). Injeta `clienteId`.
export const clienteScope: MiddlewareHandler<AppEnv> = async (c, next) => {
    const clienteId = c.req.header("X-Cliente-Id");
    if (!clienteId) throw new BadRequestError("Cabeçalho X-Cliente-Id ausente");

    const db = c.get("db");
    const clienteRow = await assertClienteNaOrg(db, c.get("organizacaoId"), clienteId);
    assertMembroPodeAcessarCliente(c.get("membro"), clienteRow);

    c.set("clienteId", clienteId);

    await next();
};
