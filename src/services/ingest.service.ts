import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { Database } from "../database";
import { account, transaction, contaProgramada } from "../database/schema";
import type { Scope } from "../types";
import type { IngestSyncInput } from "../schemas";
import { DAY_MS } from "../lib/dates";
import { autoMatch, RECONCILE_WINDOW_DAYS } from "../lib/reconcile";
import { contaProgramadaService } from "./contaProgramada.service";

// Lotes: o SELECT de dedup usa `IN (...)` — o SQLite tem teto de variáveis (~999),
// então consultamos os external_id em lotes. O INSERT também vai em lotes (padrão
// do extract-import) para não estourar o limite de statements do D1.
const LOOKUP_CHUNK = 100;
const INSERT_CHUNK = 50;

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export type IngestResult = {
    account_id: string;
    account_created: boolean;
    received: number;
    created: number;
    skipped: number;     // já existiam (dedup) ou duplicadas no próprio payload
    reconciled: number;  // compromissos baixados automaticamente (match único)
    ambiguous: number;   // transações com +1 candidato → deixadas para baixa manual
};

export const ingestService = {
    // Sincroniza uma conta externa + suas transações. Idempotente por external_id:
    // reenviar o mesmo lote não duplica nada.
    async sync(db: Database, s: Scope, input: IngestSyncInput): Promise<IngestResult> {
        // 1) Auto-registro da conta por external_id (escopo do tenant vem da chave).
        let acc = await db.query.account.findFirst({
            where: and(
                eq(account.organizacao_id, s.orgId),
                eq(account.cliente_id, s.clienteId),
                eq(account.external_id, input.account.external_id),
            ),
        });
        const account_created = !acc;
        if (!acc) {
            [acc] = await db
                .insert(account)
                .values({
                    organizacao_id: s.orgId,
                    cliente_id: s.clienteId,
                    name: input.account.name,
                    banco: input.account.banco ?? null,
                    external_id: input.account.external_id,
                    balance: 0, // saldo de abertura; o saldo atual é derivado das transações
                })
                .returning();
        }
        const accountId = acc.id;

        // 2) Dedup set-wise: quais external_id já existem no tenant.
        const incomingIds = input.transactions.map((t) => t.external_id);
        const existing = new Set<string>();
        for (const ids of chunk(incomingIds, LOOKUP_CHUNK)) {
            if (ids.length === 0) continue;
            const rows = await db.query.transaction.findMany({
                columns: { external_id: true },
                where: and(
                    eq(transaction.organizacao_id, s.orgId),
                    eq(transaction.cliente_id, s.clienteId),
                    inArray(transaction.external_id, ids),
                ),
            });
            rows.forEach((r) => r.external_id && existing.add(r.external_id));
        }

        // Também dedup DENTRO do payload (external_id repetido no mesmo lote).
        const seen = new Set<string>();
        const toInsert = input.transactions.filter((t) => {
            if (existing.has(t.external_id) || seen.has(t.external_id)) return false;
            seen.add(t.external_id);
            return true;
        });

        // 3) Insert em lotes.
        const values = toInsert.map((t) => ({
            organizacao_id: s.orgId,
            cliente_id: s.clienteId,
            account_id: accountId,
            external_id: t.external_id,
            type: t.type,
            value: t.value,
            date: t.date,
            description: t.description ?? null,
        }));

        const inserted: (typeof transaction.$inferSelect)[] = [];
        for (const part of chunk(values, INSERT_CHUNK)) {
            const res = await db.insert(transaction).values(part).returning();
            inserted.push(...res);
        }

        // 4) Conciliação automática — UMA consulta dos compromissos pendentes na janela do
        //    lote (antes era uma query por transação, o que estoura o limite de queries
        //    do D1 num lote grande) e pareamento em memória. Só baixa pares 1-para-1
        //    (lib/reconcile.autoMatch); ambíguos ficam para a baixa manual, que tem a
        //    tela de sugestões. Recorrentes baixados geram a próxima ocorrência.
        let reconciled = 0;
        let ambiguous = 0;
        if (inserted.length > 0) {
            const times = inserted.map((t) => t.date.getTime());
            const lo = new Date(Math.min(...times) - RECONCILE_WINDOW_DAYS * DAY_MS);
            const hi = new Date(Math.max(...times) + RECONCILE_WINDOW_DAYS * DAY_MS);
            const pending = await db.query.contaProgramada.findMany({
                where: and(
                    eq(contaProgramada.organizacao_id, s.orgId),
                    eq(contaProgramada.cliente_id, s.clienteId),
                    eq(contaProgramada.status, "pending"),
                    isNull(contaProgramada.transaction_id),
                    gte(contaProgramada.dueDate, lo),
                    lte(contaProgramada.dueDate, hi),
                ),
            });

            const match = autoMatch(inserted, pending);
            ambiguous = match.ambiguous;
            const byId = new Map(pending.map((p) => [p.id, p]));
            const txById = new Map(inserted.map((t) => [t.id, t]));
            for (const { txId, itemId } of match.pairs) {
                await contaProgramadaService.markPaid(
                    db,
                    s,
                    byId.get(itemId)!,
                    { transactionId: txId, paidAt: txById.get(txId)!.date },
                    null,
                );
                reconciled++;
            }
        }

        return {
            account_id: accountId,
            account_created,
            received: input.transactions.length,
            created: inserted.length,
            skipped: input.transactions.length - inserted.length,
            reconciled,
            ambiguous,
        };
    },
};
