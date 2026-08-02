import type { Context } from "hono";
import { extractService } from "../services/extract.service";
import { importExtractSchema } from "../schemas/extract.schema";
import { formatFromFileName } from "../lib/statementParser";
import { BadRequestError, NotFoundError } from "../errors/errors";
import type { AppEnv } from "../types";

export const extractController = {
    // POST /extracts  (multipart/form-data: file, account_id?)
    async uploadExtract(c: Context<AppEnv>) {
        const body = await c.req.parseBody();
        const file = body["file"];
        const accountId = typeof body["account_id"] === "string" ? body["account_id"] : undefined;

        if (!(file instanceof File)) {
            throw new BadRequestError("Envie o arquivo do extrato no campo 'file'");
        }

        const format = formatFromFileName(file.name);
        if (!format) {
            throw new BadRequestError("Formato não suportado. Use .csv, .ofx ou .pdf");
        }

        const bytes = await file.arrayBuffer();
        // Só lê como texto os formatos que serão parseados.
        const content = format === "pdf" ? "" : new TextDecoder().decode(bytes);

        const result = await extractService.upload(c.get("db"), c.env.BUCKET, c.get("userId"), {
            fileName: file.name,
            format,
            content,
            bytes,
            account_id: accountId,
        });

        return c.json(result, 201);
    },

    async listExtracts(c: Context<AppEnv>) {
        const extracts = await extractService.listByUser(c.get("db"), c.get("userId"));
        return c.json(extracts);
    },

    async getExtractById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const row = await extractService.findByIdOwned(c.get("db"), c.get("userId"), id);
        if (!row) throw new NotFoundError("Extrato");

        return c.json(row);
    },

    // POST /extracts/:id/import  (json: { account_id, entries: [...] })
    async importExtract(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = importExtractSchema.parse(await c.req.json());

        const result = await extractService.importEntries(c.get("db"), c.get("userId"), id, body);
        return c.json(result, 201);
    },

    async deleteExtract(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const deleted = await extractService.delete(c.get("db"), c.env.BUCKET, c.get("userId"), id);
        if (!deleted) throw new NotFoundError("Extrato");

        return c.json(deleted);
    },
};
