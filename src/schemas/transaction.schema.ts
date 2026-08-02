import { z } from "zod";

// user_id vem do token (contexto), nunca do corpo.
export const createTransactionSchema = z.object({
    account_id: z.cuid2("Conta inválida"),
    category_id: z.cuid2("Categoria inválida").optional(),
    // Tipo: entrada ('in') ou saída ('out').
    type: z.enum(["in", "out"], { error: "O tipo deve ser 'in' ou 'out'" }),
    description: z.string().min(1).optional(),
    // Valor SEMPRE positivo, em centavos. O sinal é dado pelo `type`.
    value: z
        .number()
        .int("O valor deve ser um inteiro (em centavos)")
        .positive("O valor deve ser maior que zero"),
    // Data da transação (opcional; default = agora no banco).
    date: z.coerce.date().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
