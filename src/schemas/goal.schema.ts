import { z } from "zod";

// user_id vem do token (contexto), nunca do corpo.
export const createGoalSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    target_value: z
        .number()
        .int("O valor alvo deve ser um inteiro (em centavos)")
        .positive("O valor alvo deve ser maior que zero"),
    current_value: z
        .number()
        .int("O valor atual deve ser um inteiro (em centavos)")
        .nonnegative("O valor atual não pode ser negativo")
        .default(0),
    // Prazo da meta (data limite).
    term: z.coerce.date({ error: "Prazo inválido" }),
    color: z.string().min(1).optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
