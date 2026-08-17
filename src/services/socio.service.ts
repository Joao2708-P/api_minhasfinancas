import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { socio } from "../database/schema";
import type { CreateSocioInput, UpdateSocioInput } from "../schemas";
import type { Scope } from "../types";
import { recordAudit } from "./audit.service";

const inScope = (s: Scope) =>
    and(eq(socio.organizacao_id, s.orgId), eq(socio.cliente_id, s.clienteId));

export const socioService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.socio.findFirst({ where: and(eq(socio.id, id), inScope(s)) });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.socio.findMany({ where: inScope(s) });
    },

    async create(db: Database, s: Scope, input: CreateSocioInput, actorUserId: string) {
        const [created] = await db
            .insert(socio)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "socio", entity_id: created.id, after: created,
        });

        return created;
    },

    async update(db: Database, s: Scope, id: string, input: UpdateSocioInput, actorUserId: string) {
        const before = await this.findByIdOwned(db, s, id);

        const [updated] = await db
            .update(socio)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(socio.id, id), inScope(s)))
            .returning();

        if (updated) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "atualizado", entity: "socio", entity_id: id, before, after: updated,
            });
        }

        return updated;
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db
            .delete(socio)
            .where(and(eq(socio.id, id), inScope(s)))
            .returning();

        if (deleted) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "excluido", entity: "socio", entity_id: id, before: deleted,
            });
        }

        return deleted;
    },
};
