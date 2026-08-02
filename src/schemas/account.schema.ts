import { z } from "zod";

// user_id NÃO entra no schema: vem sempre do token (contexto), nunca do corpo.
export const createAccountSchema = z.object({
    type_account_id: z.cuid2("Tipo de conta inválido").optional(),
    name: z.string().min(1, "O nome é obrigatório"),
    banco: z.string().min(1).optional(),
    // Saldo inicial (de abertura), em centavos. O saldo atual é derivado
    // deste valor + soma das transações.
    balance: z.number().int("O saldo deve ser um valor inteiro (em centavos)").optional(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
