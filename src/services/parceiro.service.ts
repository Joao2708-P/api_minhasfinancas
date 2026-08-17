import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { parceiro } from "../database/schema";
import type { CreateParceiroInput, UpdateParceiroInput } from "../schemas";
import type { Scope } from "../types";
import { recordAudit } from "./audit.service";

// Filtro de tenant: todo parceiro é escopado por organizacao_id + cliente_id.
const inScope = (s: Scope) =>
    and(eq(parceiro.organizacao_id, s.orgId), eq(parceiro.cliente_id, s.clienteId));

export const parceiroService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.parceiro.findFirst({ where: and(eq(parceiro.id, id), inScope(s)) });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.parceiro.findMany({ where: inScope(s) });
    },

    async create(db: Database, s: Scope, input: CreateParceiroInput, actorUserId: string) {
        const [created] = await db
            .insert(parceiro)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "parceiro", entity_id: created.id, after: created,
        });

        return created;
    },

    async update(db: Database, s: Scope, id: string, input: UpdateParceiroInput, actorUserId: string) {
        const before = await this.findByIdOwned(db, s, id);

        const [updated] = await db
            .update(parceiro)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(parceiro.id, id), inScope(s)))
            .returning();

        if (updated) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "atualizado", entity: "parceiro", entity_id: id, before, after: updated,
            });
        }

        return updated;
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db
            .delete(parceiro)
            .where(and(eq(parceiro.id, id), inScope(s)))
            .returning();

        if (deleted) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "excluido", entity: "parceiro", entity_id: id, before: deleted,
            });
        }

        return deleted;
    },
};
