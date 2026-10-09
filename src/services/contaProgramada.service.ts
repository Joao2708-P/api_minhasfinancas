import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { Database } from "../database";
import { contaProgramada, parceiro, category, transaction } from "../database/schema";
import type {
    CreateContaProgramadaInput,
    UpdateContaProgramadaInput,
    SettleContaProgramadaInput,
} from "../schemas";
import type { Scope } from "../types";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../errors/errors";
import { DAY_MS, isOverdue, nextOccurrence } from "../lib/dates";
import { rankCandidates, typeForDirection } from "../lib/reconcile";
import { recordAudit } from "./audit.service";
import { transactionService } from "./transaction.service";

type Row = typeof contaProgramada.$inferSelect;

export type ContaProgramadaFilters = {
    direction?: "payable" | "receivable";
    status?: "pending" | "paid" | "overdue" | "canceled";
    from?: Date;   // vencimento >=
    to?: Date;     // vencimento <=
};

const inScope = (s: Scope) =>
    and(eq(contaProgramada.organizacao_id, s.orgId), eq(contaProgramada.cliente_id, s.clienteId));

// `overdue` é DERIVADO (não persistido): pendente com vencimento ANTES de hoje (no dia
// do vencimento ainda não está atrasado). Evita depender de um cron para virar o
// status. O status armazenado fica pending/paid/canceled.
function withOverdue(row: Row, now = new Date()) {
    return { ...row, overdue: isOverdue(row.status, row.dueDate, now) };
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

// Transação que vai quitar o compromisso: do mesmo tenant, do tipo certo (a pagar ←
// saída, a receber ← entrada) e que ainda não quita OUTRO compromisso.
async function assertTransactionLinkable(db: Database, s: Scope, txId: string, item: Row) {
    const tx = await db.query.transaction.findFirst({
        where: and(eq(transaction.id, txId), eq(transaction.organizacao_id, s.orgId), eq(transaction.cliente_id, s.clienteId)),
    });
    if (!tx) throw new ForbiddenError("Transação não pertence a este cliente");
    if (tx.type !== typeForDirection(item.direction)) {
        throw new BadRequestError(
            item.direction === "payable"
                ? "Uma conta a pagar só pode ser quitada por uma saída"
                : "Uma conta a receber só pode ser quitada por uma entrada",
        );
    }
    const other = await db.query.contaProgramada.findFirst({
        where: and(inScope(s), eq(contaProgramada.transaction_id, txId), ne(contaProgramada.id, item.id)),
    });
    if (other) throw new ConflictError("Esta transação já quita outra conta");
    return tx;
}

// Gera a próxima ocorrência de um compromisso recorrente (mensal/semanal). Se já existir
// uma ocorrência igual nesse vencimento (ex.: baixa desfeita e refeita), não duplica.
async function spawnNext(db: Database, s: Scope, row: Row, actorUserId: string | null) {
    const anchorDay = row.anchorDay ?? row.dueDate.getUTCDate();
    const due = nextOccurrence(row.dueDate, row.recurrence, anchorDay);
    if (!due) return null;

    const dup = await db.query.contaProgramada.findFirst({
        where: and(
            inScope(s),
            eq(contaProgramada.direction, row.direction),
            eq(contaProgramada.description, row.description),
            eq(contaProgramada.dueDate, due),
            ne(contaProgramada.status, "canceled"),
        ),
    });
    if (dup) return null;

    const [created] = await db
        .insert(contaProgramada)
        .values({
            organizacao_id: s.orgId,
            cliente_id: s.clienteId,
            direction: row.direction,
            description: row.description,
            value: row.value,
            dueDate: due,
            partner_id: row.partner_id,
            category_id: row.category_id,
            recurrence: row.recurrence,
            anchorDay,
        })
        .returning();

    if (actorUserId) {
        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "conta_programada", entity_id: created.id, after: created,
        });
    }
    return created;
}

// Marca como paga (vínculo + data) e, se estava pendente e é recorrente, gera a próxima.
// Compartilhado entre a baixa manual e a auto-conciliação da ingestão (actor = null:
// não há usuário, então não audita — mesmo gap conhecido do import de extrato).
async function markPaid(
    db: Database,
    s: Scope,
    before: Row,
    link: { transactionId: string | null; paidAt: Date },
    actorUserId: string | null,
) {
    const [updated] = await db
        .update(contaProgramada)
        .set({ status: "paid", transaction_id: link.transactionId, paidAt: link.paidAt, updateAt: new Date() })
        .where(and(eq(contaProgramada.id, before.id), inScope(s)))
        .returning();

    if (actorUserId) {
        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "atualizado", entity: "conta_programada", entity_id: before.id, before, after: updated,
        });
    }

    const next = before.status === "pending" ? await spawnNext(db, s, before, actorUserId) : null;
    return { updated, next };
}

export const contaProgramadaService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        const row = await db.query.contaProgramada.findFirst({ where: and(eq(contaProgramada.id, id), inScope(s)) });
        return row ? withOverdue(row) : undefined;
    },

    async listByScope(db: Database, s: Scope, filters: ContaProgramadaFilters = {}) {
        const conditions = [inScope(s)];
        if (filters.direction) conditions.push(eq(contaProgramada.direction, filters.direction));
        // 'overdue' não é gravado: filtra 'pending' no banco e o derivado depois.
        if (filters.status) {
            conditions.push(eq(contaProgramada.status, filters.status === "overdue" ? "pending" : filters.status));
        }
        if (filters.from) conditions.push(gte(contaProgramada.dueDate, filters.from));
        if (filters.to) conditions.push(lte(contaProgramada.dueDate, filters.to));

        const rows = await db.query.contaProgramada.findMany({
            where: and(...conditions),
            orderBy: [asc(contaProgramada.dueDate)],
        });
        const now = new Date();
        const mapped = rows.map((r) => withOverdue(r, now));
        return filters.status === "overdue" ? mapped.filter((r) => r.overdue) : mapped;
    },

    async create(db: Database, s: Scope, input: CreateContaProgramadaInput, actorUserId: string) {
        await assertPartnerInScope(db, s, input.partner_id);
        await assertCategoryInScope(db, s, input.category_id);

        const [created] = await db
            .insert(contaProgramada)
            .values({
                ...input,
                anchorDay: input.dueDate.getUTCDate(),
                organizacao_id: s.orgId,
                cliente_id: s.clienteId,
            })
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

        // Voltar para pendente desfaz a baixa (solta o vínculo e a data de pagamento).
        const reopen = input.status === "pending" && before.status !== "pending";
        const [updated] = await db
            .update(contaProgramada)
            .set({
                ...input,
                // Mudou o vencimento → o novo dia passa a ser a âncora da recorrência.
                ...(input.dueDate ? { anchorDay: input.dueDate.getUTCDate() } : {}),
                ...(reopen ? { transaction_id: null, paidAt: null } : {}),
                updateAt: new Date(),
            })
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

    // Baixa/conciliação. Ver settleContaProgramadaSchema para as três formas. Devolve o
    // compromisso atualizado + `next` (a próxima ocorrência gerada, se recorrente).
    async settle(db: Database, s: Scope, id: string, input: SettleContaProgramadaInput, actorUserId: string) {
        const before = await db.query.contaProgramada.findFirst({ where: and(eq(contaProgramada.id, id), inScope(s)) });
        if (!before) throw new NotFoundError("Conta programada");
        if (before.status === "canceled") throw new BadRequestError("Conta cancelada não pode ser baixada");

        let transactionId = before.transaction_id;
        let paidAt = input.paidAt ?? before.paidAt ?? new Date();

        if (input.transaction_id) {
            const tx = await assertTransactionLinkable(db, s, input.transaction_id, before);
            transactionId = tx.id;
            paidAt = input.paidAt ?? tx.date;
        } else if (input.account_id) {
            if (before.status === "paid" && before.transaction_id) {
                throw new ConflictError("Esta conta já foi baixada com uma transação");
            }
            // Lança o pagamento na conta: valida conta/categoria no tenant e audita.
            const tx = await transactionService.create(
                db,
                s,
                {
                    account_id: input.account_id,
                    type: typeForDirection(before.direction),
                    value: input.value ?? before.value,
                    date: input.paidAt ?? new Date(),
                    description: before.description,
                    category_id: before.category_id ?? undefined,
                },
                actorUserId,
            );
            transactionId = tx.id;
            paidAt = tx.date;
        } else if (before.status === "paid") {
            // Já paga e nada novo a vincular → idempotente.
            return { ...withOverdue(before), next: null };
        }

        const { updated, next } = await markPaid(db, s, before, { transactionId, paidAt }, actorUserId);
        return { ...withOverdue(updated), next: next ? withOverdue(next) : null };
    },

    // Sugestões de conciliação para a baixa manual: transações do tipo certo, perto do
    // vencimento e com valor parecido, que ainda não quitam outro compromisso.
    async suggestions(db: Database, s: Scope, id: string) {
        const item = await db.query.contaProgramada.findFirst({ where: and(eq(contaProgramada.id, id), inScope(s)) });
        if (!item) throw new NotFoundError("Conta programada");

        const windowDays = 15;
        const txs = await db.query.transaction.findMany({
            where: and(
                eq(transaction.organizacao_id, s.orgId),
                eq(transaction.cliente_id, s.clienteId),
                eq(transaction.type, typeForDirection(item.direction)),
                gte(transaction.date, new Date(item.dueDate.getTime() - windowDays * DAY_MS)),
                lte(transaction.date, new Date(item.dueDate.getTime() + windowDays * DAY_MS)),
            ),
        });
        if (txs.length === 0) return [];

        // Exclui as que já quitam OUTRO compromisso (o próprio vínculo atual pode aparecer).
        const linked = await db.query.contaProgramada.findMany({
            columns: { transaction_id: true },
            where: and(
                inScope(s),
                ne(contaProgramada.id, item.id),
                inArray(contaProgramada.transaction_id, txs.map((t) => t.id)),
            ),
        });
        const taken = new Set(linked.map((r) => r.transaction_id));
        return rankCandidates(item, txs.filter((t) => !taken.has(t.id)), { windowDays, valueTolerancePct: 10 });
    },

    // Usado pela ingestão (auto-conciliação), sem usuário/auditoria.
    markPaid,
};
