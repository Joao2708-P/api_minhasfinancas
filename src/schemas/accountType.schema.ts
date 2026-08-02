import { z } from "zod";

export const createAccountTypeSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    description: z.string().min(1, "A descrição é obrigatória"),
});

export const updateAccountTypeSchema = createAccountTypeSchema.partial();

export type CreateAccountTypeInput = z.infer<typeof createAccountTypeSchema>;
export type UpdateAccountTypeInput = z.infer<typeof updateAccountTypeSchema>;
