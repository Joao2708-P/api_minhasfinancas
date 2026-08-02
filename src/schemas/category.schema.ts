import { z } from "zod";

// user_id vem do token (contexto), nunca do corpo.
export const createCategorySchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    // Tipo da categoria: entrada ('in') ou saída ('out').
    type: z.enum(["in", "out"], { error: "O tipo deve ser 'in' ou 'out'" }),
    icon: z.string().min(1).optional(),
    color: z.string().min(1).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
