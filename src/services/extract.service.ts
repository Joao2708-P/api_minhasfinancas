import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { account, category, extract, transaction } from "../database/schema";
import {
    parseStatement,
    type ParsedEntry,
    type StatementFormat,
} from "../lib/statementParser";
import { suggestCategoryId } from "../lib/categoryRules";
import type { ImportExtractInput } from "../schemas/extract.schema";
import type { Scope } from "../types";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/errors";

type UploadInput = {
    fileName: string;
    format: StatementFormat;
    content: string;          // texto do arquivo (csv/ofx)
    bytes: ArrayBuffer;       // conteúdo bruto para o R2
    account_id?: string;
};

// Uma entrada parseada + a categoria sugerida (para o cliente revisar).
type EntryWithSuggestion = ParsedEntry & { suggestedCategoryId?: string };

const inScope = (s: Scope) =>
    and(eq(extract.organizacao_id, s.orgId), eq(extract.cliente_id, s.clienteId));

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

export const extractService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.extract.findFirst({
            where: and(eq(extract.id, id), inScope(s)),
        });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.extract.findMany({ where: inScope(s) });
    },

    // Faz upload do arquivo para o R2, registra o extrato e, se for csv/ofx,
    // devolve os lançamentos parseados já com sugestão de categoria.
    async upload(db: Database, bucket: R2Bucket, s: Scope, input: UploadInput) {
        if (input.account_id) await assertAccountInScope(db, s, input.account_id);

        // Key isola por tenant (org/cliente), não por usuário.
        const fileKey = `${s.orgId}/${s.clienteId}/${createId()}-${input.fileName}`;
        await bucket.put(fileKey, input.bytes);

        const parsed = input.format === "pdf" ? [] : parseStatement(input.format, input.content);
        const status = input.format === "pdf" ? "pending" : "parsed";

        const [row] = await db
            .insert(extract)
            .values({
                organizacao_id: s.orgId,
                cliente_id: s.clienteId,
                account_id: input.account_id ?? null,
                fileKey,
                fileName: input.fileName,
                format: input.format,
                status,
            })
            .returning();

        // Sugere categorias com base nas categorias já cadastradas do cliente.
        const clienteCategories = await db.query.category.findMany({
            where: and(eq(category.organizacao_id, s.orgId), eq(category.cliente_id, s.clienteId)),
        });

        const entries: EntryWithSuggestion[] = parsed.map((e) => ({
            ...e,
            suggestedCategoryId: suggestCategoryId(e.description, clienteCategories),
        }));

        return { extract: row, entries };
    },

    // Efetiva a importação: cria as transações e marca o extrato como importado.
    // insert + update num db.batch() (atômico no D1) pra não duplicar dinheiro
    // se a 2ª etapa falhar.
    async importEntries(db: Database, s: Scope, extractId: string, input: ImportExtractInput) {
        const row = await this.findByIdOwned(db, s, extractId);
        if (!row) throw new NotFoundError("Extrato");
        // Idempotência básica (§7): não reimporta um extrato já importado, evitando
        // duplicar dinheiro. (Dedupe fino por FITID/hash de lançamento fica p/ depois.)
        if (row.status === "imported") {
            throw new ConflictError("Este extrato já foi importado");
        }

        await assertAccountInScope(db, s, input.account_id);

        const values = input.entries.map((e) => ({
            organizacao_id: s.orgId,
            cliente_id: s.clienteId,
            account_id: input.account_id,
            category_id: e.category_id ?? null,
            type: e.type,
            description: e.description ?? null,
            value: e.value,
            date: e.date,
        }));

        const [created, updatedRows] = await db.batch([
            db.insert(transaction).values(values).returning(),
            db
                .update(extract)
                .set({
                    status: "imported",
                    account_id: input.account_id,
                    importedCount: values.length,
                    updateAt: new Date(),
                })
                .where(and(eq(extract.id, extractId), inScope(s)))
                .returning(),
        ]);

        return { extract: updatedRows[0], imported: created.length };
    },

    async delete(db: Database, bucket: R2Bucket, s: Scope, id: string) {
        const row = await this.findByIdOwned(db, s, id);
        if (!row) return undefined;

        // Remove o objeto do R2 antes de apagar o registro.
        await bucket.delete(row.fileKey);

        const [deleted] = await db
            .delete(extract)
            .where(and(eq(extract.id, id), inScope(s)))
            .returning();

        return deleted;
    },
};
