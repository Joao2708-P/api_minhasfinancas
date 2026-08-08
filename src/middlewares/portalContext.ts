import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { cliente } from "../database/schema";
import { ForbiddenError } from "../errors/errors";

// Contexto do PORTAL DO CLIENTE. Diferente do orgContext: o cliente do portal NÃO
// é `membro` da org. O `clienteId` é derivado do vínculo `cliente.usuario_id = userId`
// — NUNCA de um header (senão um cliente forjaria o id de outro).
//
// Injeta `organizacaoId` + `clienteId` (os mesmos que os controllers financeiros
// leem do contexto), então as rotas do portal reusam os controllers existentes —
// mas só as de LEITURA (o portal é read-only: o cliente vê, o contador gerencia).
export const portalContext: MiddlewareHandler<AppEnv> = async (c, next) => {
    const db = c.get("db");

    const row = await db.query.cliente.findFirst({
        where: and(eq(cliente.user_id, c.get("userId")), eq(cliente.status, "ativo")),
    });
    if (!row) throw new ForbiddenError("Acesso de cliente não encontrado");

    c.set("organizacaoId", row.organizacao_id);
    c.set("clienteId", row.id);

    await next();
};
