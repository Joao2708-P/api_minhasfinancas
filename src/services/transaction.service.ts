import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Database } from "../database";
import { account, category, contaProgramada, transaction } from "../database/schema";
import type { CreateTransactionInput, UpdateTransactionInput } from "../schemas";
import type { Scope } from "../types";
import { ForbiddenError, NotFoundError } from "../errors/errors";
import { recordAudit } from "./audit.service";

export type TransactionFilters = {
    account_id?: string;
    category_id?: string;
    type?: "in" | "out";
    from?: Date;
    to?: Date;
    limit?: number;   // paginação opcional (sem limite = tudo)
    offset?: number;
};

const inScope = (s: Scope) =>
    and(eq(transaction.organizacao_id, s.orgId), eq(transaction.cliente_id, s.clienteId));

// Garante que a conta pertence ao mesmo tenant (org+cliente).
async function assertAccountInScope(db: Database, s: Scope, accountId: string) {
    const acc = await db.query.account.findFirst({
        where: and(
            eq(account.id, accountId),
            eq(account.organizacao_id, s.orgId),
            eq(account.cliente_id, s.clienteId),
        ),
    });
    if (!acc) throw new ForbiddenError("Conta não pertence a este cliente");
}

// Garante que a categoria (se informada) pertence ao mesmo tenant.
async function assertCategoryInScope(db: Database, s: Scope, categoryId?: string) {
    if (!categoryId) return;
    const cat = await db.query.category.findFirst({
        where: and(
            eq(category.id, categoryId),
            eq(category.organizacao_id, s.orgId),
            eq(category.cliente_id, s.clienteId),
        ),
    });
    if (!cat) throw new ForbiddenError("Categoria não pertence a este cliente");
}

export const transactionService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.transaction.findFirst({
            where: and(eq(transaction.id, id), inScope(s)),
        });
    },

    async listByScope(db: Database, s: Scope, filters: TransactionFilters = {}) {
        const conditions = [inScope(s)];

        if (filters.account_id) conditions.push(eq(transaction.account_id, filters.account_id));
        if (filters.category_id) conditions.push(eq(transaction.category_id, filters.category_id));
        if (filters.type) conditions.push(eq(transaction.type, filters.type));
        if (filters.from) conditions.push(gte(transaction.date, filters.from));
        if (filters.to) conditions.push(lte(transaction.date, filters.to));

        return db.query.transaction.findMany({
            where: and(...conditions),
            orderBy: [desc(transaction.date)],
            limit: filters.limit,
            offset: filters.offset,
        });
    },

    async create(db: Database, s: Scope, input: CreateTransactionInput, actorUserId: string) {
        await assertAccountInScope(db, s, input.account_id);
        await assertCategoryInScope(db, s, input.category_id);

        const [created] = await db
            .insert(transaction)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "transacao", entity_id: created.id, after: created,
        });

        return created;
    },

    async update(db: Database, s: Scope, id: string, input: UpdateTransactionInput, actorUserId: string) {
        const existing = await this.findByIdOwned(db, s, id);
        if (!existing) throw new NotFoundError("Transação");

        if (input.account_id) await assertAccountInScope(db, s, input.account_id);
        if (input.category_id) await assertCategoryInScope(db, s, input.category_id);

        const [updated] = await db
            .update(transaction)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(transaction.id, id), inScope(s)))
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "atualizado", entity: "transacao", entity_id: id, before: existing, after: updated,
        });

        return updated;
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        // Se esta transação quitava uma conta a pagar/receber, a baixa é desfeita (volta
        // a pendente). Sem isso, a FK `set null` deixaria o compromisso "pago" sem
        // pagamento nenhum — e ele sumiria do fluxo de caixa projetado.
        await db
            .update(contaProgramada)
            .set({ status: "pending", transaction_id: null, paidAt: null, updateAt: new Date() })
            .where(and(
                eq(contaProgramada.transaction_id, id),
                eq(contaProgramada.organizacao_id, s.orgId),
                eq(contaProgramada.cliente_id, s.clienteId),
            ));

        const [deleted] = await db
            .delete(transaction)
            .where(and(eq(transaction.id, id), inScope(s)))
            .returning();

        // `deleted` é a linha que existia (o "antes"); ausente = nada apagado, nada a logar.
        if (deleted) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "excluido", entity: "transacao", entity_id: id, before: deleted,
            });
        }

        return deleted;
    },
};
