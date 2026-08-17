import { z } from "zod";

// Compromisso futuro (conta a pagar/receber). organizacao_id/cliente_id vêm do
// contexto de tenant, nunca do corpo. status não entra na criação (nasce 'pending').
export const createContaProgramadaSchema = z.object({
    direction: z.enum(["payable", "receivable"], { error: "Direção inválida" }),
    description: z.string().min(1, "A descrição é obrigatória"),
    value: z
        .number()
        .int("O valor deve ser um inteiro (em centavos)")
        .positive("O valor deve ser maior que zero"),
    dueDate: z.coerce.date({ error: "Vencimento inválido" }),
    partner_id: z.cuid2("Parceiro inválido").optional(),
    category_id: z.cuid2("Categoria inválida").optional(),
    recurrence: z.enum(["once", "monthly", "weekly"]).default("once"),
});

export const updateContaProgramadaSchema = createContaProgramadaSchema.partial().extend({
    status: z.enum(["pending", "paid", "overdue", "canceled"]).optional(),
});

// Baixa/conciliação: marca como paga; opcionalmente vincula a transação que quitou.
export const settleContaProgramadaSchema = z.object({
    transaction_id: z.cuid2("Transação inválida").optional(),
});

export type CreateContaProgramadaInput = z.infer<typeof createContaProgramadaSchema>;
export type UpdateContaProgramadaInput = z.infer<typeof updateContaProgramadaSchema>;
export type SettleContaProgramadaInput = z.infer<typeof settleContaProgramadaSchema>;
