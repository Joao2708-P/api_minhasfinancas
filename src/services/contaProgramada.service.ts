import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../database";
import { contaProgramada, parceiro, category, transaction } from "../database/schema";
import type {
    CreateContaProgramadaInput,
    UpdateContaProgramadaInput,
    SettleContaProgramadaInput,
} from "../schemas";
import type { Scope } from "../types";
import { ForbiddenError, NotFoundError } from "../errors/errors";
import { recordAudit } from "./audit.service";

type Row = typeof contaProgramada.$inferSelect;

export type ContaProgramadaFilters = {
    direction?: "payable" | "receivable";
    status?: "pending" | "paid" | "overdue" | "canceled";
    from?: Date;   // vencimento >=
    to?: Date;     // vencimento <=
};

const inScope = (s: Scope) =>
    and(eq(contaProgramada.organizacao_id, s.orgId), eq(contaProgramada.cliente_id, s.clienteId));

// `overdue` é DERIVADO (não persistido): pendente com vencimento no passado. Evita
// depender de um cron para virar o status. O status armazenado fica pending/paid/canceled.
function withOverdue(row: Row, now = new Date()) {
    return { ...row, overdue: row.status === "pending" && row.dueDate.getTime() < now.getTime() };
}

// Garante que uma FK opcional pertence ao mesmo tenant (não vaza entre clientes).
async function assertPartnerInScope(db: Database, s: Scope, id?: string | null) {
    if (!id) return;
    const row = await db.query.parceiro.findFirst({
        where: and(eq(parceiro.id, id), eq(parceiro.organizacao_id, s.orgId), eq(parceiro.cliente_id, s.clienteId)),
    });
    if (!row) throw new ForbiddenError("Parceiro não pertence a este cliente");
}
async function assertCategoryInScope(db: Database, s: Scope, id?: string | null) {
    if (!id) return;
    const row = await db.query.category.findFirst({
        where: and(eq(category.id, id), eq(category.organizacao_id, s.orgId), eq(category.cliente_id, s.clienteId)),
    });
    if (!row) throw new ForbiddenError("Categoria não pertence a este cliente");
}
async function assertTransactionInScope(db: Database, s: Scope, id?: string | null) {
    if (!id) return;
    const row = await db.query.transaction.findFirst({
        where: and(eq(transaction.id, id), eq(transaction.organizacao_id, s.orgId), eq(transaction.cliente_id, s.clienteId)),
    });
    if (!row) throw new ForbiddenError("Transação não pertence a este cliente");
}

export const contaProgramadaService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        const row = await db.query.contaProgramada.findFirst({ where: and(eq(contaProgramada.id, id), inScope(s)) });
        return row ? withOverdue(row) : undefined;
    },

    async listByScope(db: Database, s: Scope, filters: ContaProgramadaFilters = {}) {
        const conditions = [inScope(s)];
        if (filters.direction) conditions.push(eq(contaProgramada.direction, filters.direction));
        if (filters.status) conditions.push(eq(contaProgramada.status, filters.status));
        if (filters.from) conditions.push(gte(contaProgramada.dueDate, filters.from));
        if (filters.to) conditions.push(lte(contaProgramada.dueDate, filters.to));

        const rows = await db.query.contaProgramada.findMany({
            where: and(...conditions),
            orderBy: [asc(contaProgramada.dueDate)],
        });
        const now = new Date();
        // Filtro 'overdue' é sobre o campo DERIVADO → aplicado após buscar.
        const mapped = rows.map((r) => withOverdue(r, now));
        return filters.status === "overdue" ? mapped.filter((r) => r.overdue) : mapped;
    },

    async create(db: Database, s: Scope, input: CreateContaProgramadaInput, actorUserId: string) {
        await assertPartnerInScope(db, s, input.partner_id);
        await assertCategoryInScope(db, s, input.category_id);

        const [created] = await db
            .insert(contaProgramada)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "conta_programada", entity_id: created.id, after: created,
        });
        return withOverdue(created);
    },

    async update(db: Database, s: Scope, id: string, input: UpdateContaProgramadaInput, actorUserId: string) {
        const before = await db.query.contaProgramada.findFirst({ where: and(eq(contaProgramada.id, id), inScope(s)) });
        if (!before) throw new NotFoundError("Conta programada");

        await assertPartnerInScope(db, s, input.partner_id);
        await assertCategoryInScope(db, s, input.category_id);

        const [updated] = await db
            .update(contaProgramada)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(contaProgramada.id, id), inScope(s)))
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "atualizado", entity: "conta_programada", entity_id: id, before, after: updated,
        });
        return withOverdue(updated);
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db
            .delete(contaProgramada)
            .where(and(eq(contaProgramada.id, id), inScope(s)))
            .returning();
        if (!deleted) return undefined;

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "excluido", entity: "conta_programada", entity_id: id, before: deleted,
        });
        return deleted;
    },

    // Baixa/conciliação: marca como paga; opcionalmente vincula a transação que quitou
    // (validada no mesmo tenant). Idempotente-ish: já paga -> apenas atualiza o vínculo.
    async settle(db: Database, s: Scope, id: string, input: SettleContaProgramadaInput, actorUserId: string) {
        const before = await db.query.contaProgramada.findFirst({ where: and(eq(contaProgramada.id, id), inScope(s)) });
        if (!before) throw new NotFoundError("Conta programada");

        await assertTransactionInScope(db, s, input.transaction_id);

        const [updated] = await db
            .update(contaProgramada)
            .set({ status: "paid", transaction_id: input.transaction_id ?? before.transaction_id, updateAt: new Date() })
            .where(and(eq(contaProgramada.id, id), inScope(s)))
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "atualizado", entity: "conta_programada", entity_id: id, before, after: updated,
        });
        return withOverdue(updated);
    },
};
