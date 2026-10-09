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

// `overdue` NÃO é aceito aqui: é derivado na leitura (pendente vencido), nunca gravado.
// Para quitar use POST /:id/settle (cria/vincula a transação e gera a próxima recorrência).
export const updateContaProgramadaSchema = createContaProgramadaSchema.partial().extend({
    status: z.enum(["pending", "paid", "canceled"], { error: "Status inválido" }).optional(),
});

// Baixa/conciliação. Três formas:
//   - `transaction_id`: vincula uma transação já existente (ex.: sugestão de conciliação);
//   - `account_id`: CRIA a transação na conta (saída p/ a pagar, entrada p/ a receber);
//   - nenhum dos dois: só marca como paga (pagamento fora das contas cadastradas).
// `paidAt`/`value` ajustam data e valor efetivos (juros, multa, desconto) — valem para
// a transação criada via `account_id`.
export const settleContaProgramadaSchema = z
    .object({
        transaction_id: z.cuid2("Transação inválida").optional(),
        account_id: z.cuid2("Conta inválida").optional(),
        paidAt: z.coerce.date({ error: "Data de pagamento inválida" }).optional(),
        value: z
            .number()
            .int("O valor deve ser um inteiro (em centavos)")
            .positive("O valor deve ser maior que zero")
            .optional(),
    })
    .refine((v) => !(v.transaction_id && v.account_id), {
        message: "Informe a transação existente OU a conta para lançar, não os dois",
    });

export type CreateContaProgramadaInput = z.infer<typeof createContaProgramadaSchema>;
export type UpdateContaProgramadaInput = z.infer<typeof updateContaProgramadaSchema>;
export type SettleContaProgramadaInput = z.infer<typeof settleContaProgramadaSchema>;
