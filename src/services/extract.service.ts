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
import { ForbiddenError, NotFoundError } from "../errors/errors";

type UploadInput = {
    fileName: string;
    format: StatementFormat;
    content: string;          // texto do arquivo (csv/ofx)
    bytes: ArrayBuffer;       // conteúdo bruto para o R2
    account_id?: string;
};

// Uma entrada parseada + a categoria sugerida (para o cliente revisar).
type EntryWithSuggestion = ParsedEntry & { suggestedCategoryId?: string };

async function assertAccountOwned(db: Database, userId: string, accountId: string) {
    const acc = await db.query.account.findFirst({
        where: and(eq(account.id, accountId), eq(account.user_id, userId)),
    });
    if (!acc) throw new ForbiddenError("Conta não pertence ao usuário");
}

export const extractService = {
    async findByIdOwned(db: Database, userId: string, id: string) {
        return db.query.extract.findFirst({
            where: and(eq(extract.id, id), eq(extract.user_id, userId)),
        });
    },

    async listByUser(db: Database, userId: string) {
        return db.query.extract.findMany({
            where: eq(extract.user_id, userId),
        });
    },

    // Faz upload do arquivo para o R2, registra o extrato e, se for csv/ofx,
    // devolve os lançamentos parseados já com sugestão de categoria.
    async upload(db: Database, bucket: R2Bucket, userId: string, input: UploadInput) {
        if (input.account_id) await assertAccountOwned(db, userId, input.account_id);

        const fileKey = `${userId}/${createId()}-${input.fileName}`;
        await bucket.put(fileKey, input.bytes);

        const parsed = input.format === "pdf" ? [] : parseStatement(input.format, input.content);
        const status = input.format === "pdf" ? "pending" : "parsed";

        const [row] = await db
            .insert(extract)
            .values({
                user_id: userId,
                account_id: input.account_id ?? null,
                fileKey,
                fileName: input.fileName,
                format: input.format,
                status,
            })
            .returning();

        // Sugere categorias com base nas categorias já cadastradas do usuário.
        const userCategories = await db.query.category.findMany({
            where: eq(category.user_id, userId),
        });

        const entries: EntryWithSuggestion[] = parsed.map((e) => ({
            ...e,
            suggestedCategoryId: suggestCategoryId(e.description, userCategories),
        }));

        return { extract: row, entries };
    },

    // Efetiva a importação: cria as transações a partir dos lançamentos
    // (já revisados pelo cliente) e marca o extrato como importado.
    async importEntries(db: Database, userId: string, extractId: string, input: ImportExtractInput) {
        const row = await this.findByIdOwned(db, userId, extractId);
        if (!row) throw new NotFoundError("Extrato");

        await assertAccountOwned(db, userId, input.account_id);

        const values = input.entries.map((e) => ({
            user_id: userId,
            account_id: input.account_id,
            category_id: e.category_id ?? null,
            type: e.type,
            description: e.description ?? null,
            value: e.value,
            date: e.date,
        }));

        const created = await db.insert(transaction).values(values).returning();

        const [updated] = await db
            .update(extract)
            .set({
                status: "imported",
                account_id: input.account_id,
                importedCount: created.length,
                updateAt: new Date(),
            })
            .where(and(eq(extract.id, extractId), eq(extract.user_id, userId)))
            .returning();

        return { extract: updated, imported: created.length };
    },

    async delete(db: Database, bucket: R2Bucket, userId: string, id: string) {
        const row = await this.findByIdOwned(db, userId, id);
        if (!row) return undefined;

        // Remove o objeto do R2 antes de apagar o registro.
        await bucket.delete(row.fileKey);

        const [deleted] = await db
            .delete(extract)
            .where(and(eq(extract.id, id), eq(extract.user_id, userId)))
            .returning();

        return deleted;
    },
};
