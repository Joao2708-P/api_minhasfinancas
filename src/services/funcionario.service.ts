import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { funcionario } from "../database/schema";
import type { CreateFuncionarioInput, UpdateFuncionarioInput } from "../schemas";
import type { Scope } from "../types";
import { recordAudit } from "./audit.service";

const inScope = (s: Scope) =>
    and(eq(funcionario.organizacao_id, s.orgId), eq(funcionario.cliente_id, s.clienteId));

export const funcionarioService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.funcionario.findFirst({ where: and(eq(funcionario.id, id), inScope(s)) });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.funcionario.findMany({ where: inScope(s) });
    },

    async create(db: Database, s: Scope, input: CreateFuncionarioInput, actorUserId: string) {
        const [created] = await db
            .insert(funcionario)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "funcionario", entity_id: created.id, after: created,
        });

        return created;
    },

    async update(db: Database, s: Scope, id: string, input: UpdateFuncionarioInput, actorUserId: string) {
        const before = await this.findByIdOwned(db, s, id);

        const [updated] = await db
            .update(funcionario)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(funcionario.id, id), inScope(s)))
            .returning();

        if (updated) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "atualizado", entity: "funcionario", entity_id: id, before, after: updated,
            });
        }

        return updated;
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db
            .delete(funcionario)
            .where(and(eq(funcionario.id, id), inScope(s)))
            .returning();

        if (deleted) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "excluido", entity: "funcionario", entity_id: id, before: deleted,
            });
        }

        return deleted;
    },
};
