import { z } from "zod";

// Payload de ingestão (normalizado, provider-agnóstico). O agregador (Pluggy/Belvo/
// Tecnospeed) ou um job mapeia sua resposta para este formato.
//
// org/cliente NÃO entram aqui — vêm da CHAVE (ingestGuard). Valores em centavos.
export const ingestSyncSchema = z.object({
    account: z.object({
        // Id da conta na fonte externa — chave de auto-registro/dedup da conta.
        external_id: z.string().min(1, "account.external_id é obrigatório"),
        name: z.string().min(1, "account.name é obrigatório"),
        banco: z.string().optional(),
    }),
    // Teto por request (dedup faz SELECT em lotes; ver ingest.service). 500 é seguro
    // para o limite de variáveis do SQLite mesmo com lotes.
    transactions: z
        .array(
            z.object({
                external_id: z.string().min(1, "transactions[].external_id é obrigatório"),
                type: z.enum(["in", "out"]),
                value: z.number().int("valor em centavos").positive("valor deve ser > 0"),
                date: z.coerce.date({ error: "data inválida" }),
                description: z.string().optional(),
            }),
        )
        .max(500, "Máximo de 500 transações por requisição"),
});

export type IngestSyncInput = z.infer<typeof ingestSyncSchema>;
