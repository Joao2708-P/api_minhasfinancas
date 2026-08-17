import { z } from "zod";

export const createSocioSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    document: z.string().min(1, "O CPF é obrigatório"),
    // Participação societária como fração: 0.5 = 50%. (0, 1].
    equityShare: z
        .number()
        .gt(0, "A participação deve ser maior que zero")
        .max(1, "A participação não pode passar de 100% (1.0)"),
    joinedAt: z.coerce.date({ error: "Data de entrada inválida" }),
});

export const updateSocioSchema = createSocioSchema.partial();

export type CreateSocioInput = z.infer<typeof createSocioSchema>;
export type UpdateSocioInput = z.infer<typeof updateSocioSchema>;
