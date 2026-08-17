import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { membro as membroTable, organizacao, papelPermissao } from "../database/schema";
import { BadRequestError, ForbiddenError } from "../errors/errors";
import { canWith, resolvePermissions, type Permission } from "../lib/permissions";
import { assertClienteNaOrg, assertMembroPodeAcessarCliente } from "../lib/tenant";

// Resolve a organização ativa (header X-Org-Id) e carrega o membro ativo.
// O status é lido a CADA request → revogar (status='revoked') bloqueia na hora,
// independente do TTL do JWT.
export const orgContext: MiddlewareHandler<AppEnv> = async (c, next) => {
    const db = c.get("db");

    // Org ativa por X-Org-Id (dashboard) ou, no white-label, pelo subdomínio.
    let orgId = c.req.header("X-Org-Id");
    if (!orgId) {
        const subdomain = c.req.header("X-Org-Subdomain");
        if (subdomain) {
            const org = await db.query.organizacao.findFirst({
                where: eq(organizacao.subdomain, subdomain),
            });
            orgId = org?.id;
        }
    }
    if (!orgId) throw new BadRequestError("Cabeçalho X-Org-Id ausente");

    const m = await db.query.membro.findFirst({
        where: and(
            eq(membroTable.organizacao_id, orgId),
            eq(membroTable.user_id, c.get("userId")),
            eq(membroTable.status, "active"),
        ),
    });
    if (!m) throw new ForbiddenError("Você não é membro ativo desta organização");

    // Permissões efetivas: se o membro tem papel customizado, as chaves vêm de
    // `papel_permissao`; senão, `resolvePermissions` cai no conjunto fixo do `role`.
    // Resolvido UMA vez por request e guardado no contexto (o requirePermission de
    // cada rota só consulta, sem novo hit no banco).
    let customKeys: string[] | null = null;
    if (m.papel_id) {
        const rows = await db.query.papelPermissao.findMany({
            where: eq(papelPermissao.papel_id, m.papel_id),
        });
        customKeys = rows.map((r) => r.permission_key);
    }
    const permissions = resolvePermissions(m.role, customKeys);

    c.set("organizacaoId", orgId);
    c.set("membro", { id: m.id, role: m.role, user_id: m.user_id, permissions });

    await next();
};

// Bloqueia com 403 quem não tem a permissão (checa o conjunto efetivo já resolvido).
export function requirePermission(perm: Permission): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        if (!canWith(c.get("membro").permissions, perm)) {
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
