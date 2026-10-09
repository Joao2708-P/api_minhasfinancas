import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../database";
import { chaveIngestao } from "../database/schema";
import type { Scope } from "../types";
import type { CreateIngestKeyInput } from "../schemas";
import { generateIngestKey, hashIngestKey, last4 } from "../lib/ingestKey";
import { recordAudit } from "./audit.service";

const inScope = (s: Scope) =>
    and(eq(chaveIngestao.organizacao_id, s.orgId), eq(chaveIngestao.cliente_id, s.clienteId));

// Nunca expõe o hash do token nas respostas.
function redact<T extends { tokenHash?: string }>(row: T) {
    const { tokenHash: _omit, ...rest } = row;
    return rest;
}

export const ingestKeyService = {
    async listByScope(db: Database, s: Scope) {
        const rows = await db.query.chaveIngestao.findMany({
            where: inScope(s),
            orderBy: [desc(chaveIngestao.createdAt)],
        });
        return rows.map(redact);
    },

    // Cria a chave e devolve o token CRU uma única vez (não é recuperável depois).
    async create(db: Database, s: Scope, input: CreateIngestKeyInput, actorUserId: string) {
        const raw = generateIngestKey();
        const tokenHash = await hashIngestKey(raw);
        const [created] = await db
            .insert(chaveIngestao)
            .values({
                organizacao_id: s.orgId,
                cliente_id: s.clienteId,
                name: input.name,
                tokenHash,
                last4: last4(raw),
            })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "chave_ingestao", entity_id: created.id,
            after: { id: created.id, name: created.name, last4: created.last4 }, // sem hash
        });

        // `key` só aparece nesta resposta.
        return { ...redact(created), key: raw };
    },

    async revoke(db: Database, s: Scope, id: string, actorUserId: string) {
        const [updated] = await db
            .update(chaveIngestao)
            .set({ revoked: true })
            .where(and(eq(chaveIngestao.id, id), inScope(s)))
            .returning();
        if (!updated) return undefined;

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "atualizado", entity: "chave_ingestao", entity_id: id,
            after: { id, revoked: true },
        });
        return redact(updated);
    },
};
