import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../database";
import { account, transaction } from "../database/schema";
import type { CreateAccountInput, UpdateAccountInput } from "../schemas";
import type { Scope } from "../types";
import { recordAudit } from "./audit.service";

// Filtro de tenant: toda conta é escopada por organizacao_id + cliente_id.
const inScope = (s: Scope) =>
    and(eq(account.organizacao_id, s.orgId), eq(account.cliente_id, s.clienteId));

export const accountService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.account.findFirst({
            where: and(eq(account.id, id), inScope(s)),
        });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.account.findMany({ where: inScope(s) });
    },

    // Lista as contas do tenant JÁ com o saldo atual de cada uma
    // (abertura + entradas − saídas). O somatório por conta sai de UMA query
    // agregada (evita N+1) e é escopado por org+cliente.
    async listWithBalances(db: Database, s: Scope) {
        const accounts = await db.query.account.findMany({ where: inScope(s) });

        const netRows = await db
            .select({
                accountId: transaction.account_id,
                incomes: sql<number>`coalesce(sum(case when ${transaction.type} = 'in' then ${transaction.value} else 0 end), 0)`,
                expenses: sql<number>`coalesce(sum(case when ${transaction.type} = 'out' then ${transaction.value} else 0 end), 0)`,
            })
            .from(transaction)
            .where(and(eq(transaction.organizacao_id, s.orgId), eq(transaction.cliente_id, s.clienteId)))
            .groupBy(transaction.account_id);

        // account_id → net (entradas − saídas) daquela conta.
        const netByAccount = new Map<string, number>();
        for (const r of netRows) {
            if (r.accountId) netByAccount.set(r.accountId, Number(r.incomes) - Number(r.expenses));
        }

        return accounts.map((a) => ({
            ...a,
            currentBalance: (a.balance ?? 0) + (netByAccount.get(a.id) ?? 0),
        }));
    },

    async create(db: Database, s: Scope, input: CreateAccountInput, actorUserId: string) {
        const [created] = await db
            .insert(account)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "conta", entity_id: created.id, after: created,
        });

        return created;
    },

    async update(db: Database, s: Scope, id: string, input: UpdateAccountInput, actorUserId: string) {
        const before = await this.findByIdOwned(db, s, id);

        const [updated] = await db
            .update(account)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(account.id, id), inScope(s)))
            .returning();

        if (updated) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "atualizado", entity: "conta", entity_id: id, before, after: updated,
            });
        }

        return updated;
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db
            .delete(account)
            .where(and(eq(account.id, id), inScope(s)))
            .returning();

        if (deleted) {
            await recordAudit(db, {
                organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
                action: "excluido", entity: "conta", entity_id: id, before: deleted,
            });
        }

        return deleted;
    },

    // Saldo atual = abertura + entradas - saídas. Agregação escopada por
    // org+cliente pra não vazar saldo entre tenants.
    async currentBalance(db: Database, s: Scope, accountId: string, openingBalance: number) {
        const [row] = await db
            .select({
                incomes: sql<number>`coalesce(sum(case when ${transaction.type} = 'in' then ${transaction.value} else 0 end), 0)`,
                expenses: sql<number>`coalesce(sum(case when ${transaction.type} = 'out' then ${transaction.value} else 0 end), 0)`,
            })
            .from(transaction)
            .where(
                and(
                    eq(transaction.account_id, accountId),
                    eq(transaction.organizacao_id, s.orgId),
                    eq(transaction.cliente_id, s.clienteId),
                ),
            );

        const incomes = Number(row?.incomes ?? 0);
        const expenses = Number(row?.expenses ?? 0);

        return openingBalance + incomes - expenses;
    },
};
