import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../database";
import { bem } from "../database/schema";
import type { CreateBemInput, UpdateBemInput } from "../schemas";
import type { Scope } from "../types";
import { BadRequestError, NotFoundError } from "../errors/errors";
import { assetPerformance, summarizeAssets } from "../lib/assets";
import { recordAudit } from "./audit.service";
import { accountService } from "./account.service";

type Row = typeof bem.$inferSelect;

const inScope = (s: Scope) => and(eq(bem.organizacao_id, s.orgId), eq(bem.cliente_id, s.clienteId));

// Linha + desempenho derivado (ganho, % e retorno anualizado) — não persistido.
const withPerformance = (row: Row, now = new Date()) => ({ ...row, ...assetPerformance(row, now) });

export const bemService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        const row = await db.query.bem.findFirst({ where: and(eq(bem.id, id), inScope(s)) });
        return row ? withPerformance(row) : undefined;
    },

    async listByScope(db: Database, s: Scope) {
        const rows = await db.query.bem.findMany({ where: inScope(s), orderBy: [asc(bem.kind), asc(bem.name)] });
        const now = new Date();
        return rows.map((r) => withPerformance(r, now));
    },

    // Consolidado: totais por tipo/classe + patrimônio líquido (contas + bens).
    async summary(db: Database, s: Scope) {
        const [rows, accountsBalance] = await Promise.all([
            db.query.bem.findMany({ where: inScope(s) }),
            accountService.totalCurrentBalance(db, s),
        ]);
        return summarizeAssets(rows, accountsBalance);
    },

    async create(db: Database, s: Scope, input: CreateBemInput, actorUserId: string) {
        const [created] = await db
            .insert(bem)
            .values({
                ...input,
                // Classe só existe para investimento (o schema já valida; aqui normaliza).
                investmentClass: input.kind === "investment" ? input.investmentClass ?? "other" : null,
                organizacao_id: s.orgId,
                cliente_id: s.clienteId,
            })
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "criado", entity: "bem", entity_id: created.id, after: created,
        });
        return withPerformance(created);
    },

    async update(db: Database, s: Scope, id: string, input: UpdateBemInput, actorUserId: string) {
        const before = await db.query.bem.findFirst({ where: and(eq(bem.id, id), inScope(s)) });
        if (!before) throw new NotFoundError("Bem");

        const kind = input.kind ?? before.kind;
        if (kind !== "investment" && input.investmentClass) {
            throw new BadRequestError("Classe de investimento só se aplica a bens do tipo investimento");
        }
        const investmentClass =
            kind === "investment" ? input.investmentClass ?? before.investmentClass ?? "other" : null;

        const [updated] = await db
            .update(bem)
            .set({ ...input, investmentClass, updateAt: new Date() })
            .where(and(eq(bem.id, id), inScope(s)))
            .returning();

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "atualizado", entity: "bem", entity_id: id, before, after: updated,
        });
        return withPerformance(updated);
    },

    async delete(db: Database, s: Scope, id: string, actorUserId: string) {
        const [deleted] = await db.delete(bem).where(and(eq(bem.id, id), inScope(s))).returning();
        if (!deleted) return undefined;

        await recordAudit(db, {
            organizacao_id: s.orgId, cliente_id: s.clienteId, user_id: actorUserId,
            action: "excluido", entity: "bem", entity_id: id, before: deleted,
        });
        return deleted;
    },
};
