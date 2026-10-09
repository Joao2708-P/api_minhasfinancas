import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { chaveIngestao } from "../database/schema";
import { UnauthorizedError } from "../errors/errors";
import { hashIngestKey } from "../lib/ingestKey";

// Autentica a ingestão pela CHAVE por cliente (header `X-Ingest-Key` ou
// `Authorization: Bearer <chave>`). O escopo org+cliente vem DA CHAVE, nunca do
// payload — mesma invariante do userId-do-token no resto da API.
export const ingestGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
    const raw =
        c.req.header("X-Ingest-Key") ??
        c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!raw) throw new UnauthorizedError("Chave de ingestão ausente");

    const db = c.get("db");
    const tokenHash = await hashIngestKey(raw.trim());
    const key = await db.query.chaveIngestao.findFirst({
        where: and(eq(chaveIngestao.tokenHash, tokenHash), eq(chaveIngestao.revoked, false)),
    });
    if (!key) throw new UnauthorizedError("Chave de ingestão inválida ou revogada");

    c.set("organizacaoId", key.organizacao_id);
    c.set("clienteId", key.cliente_id);

    // Marca o último uso (barato, uma linha). Não é crítico se falhar.
    await db
        .update(chaveIngestao)
        .set({ lastUsedAt: new Date() })
        .where(eq(chaveIngestao.id, key.id))
        .catch(() => {});

    await next();
};
