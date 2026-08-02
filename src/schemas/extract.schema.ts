import { z } from "zod";

// Uma linha de lançamento parseada do extrato (ou editada pelo cliente
// antes da importação). Valor sempre positivo; o sinal vem do `type`.
export const extractEntrySchema = z.object({
    date: z.coerce.date(),
    description: z.string().optional(),
    type: z.enum(["in", "out"]),
    value: z.number().int("O valor deve ser um inteiro (em centavos)").positive(),
    category_id: z.cuid2("Categoria inválida").optional(),
});

// Confirmação da importação: o cliente pode revisar/ajustar as categorias
// antes de efetivar as transações.
export const importExtractSchema = z.object({
    account_id: z.cuid2("Conta inválida"),
    entries: z.array(extractEntrySchema).min(1, "Nenhum lançamento para importar"),
});

export type ExtractEntryInput = z.infer<typeof extractEntrySchema>;
export type ImportExtractInput = z.infer<typeof importExtractSchema>;
