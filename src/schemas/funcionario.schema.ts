import { z } from "zod";

export const createFuncionarioSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    document: z.string().min(1, "O CPF é obrigatório"),
    role: z.string().min(1).optional(),
    baseSalary: z
        .number()
        .int("O salário base deve ser um inteiro (em centavos)")
        .nonnegative("O salário base não pode ser negativo"),
    hiredAt: z.coerce.date({ error: "Data de admissão inválida" }),
    terminatedAt: z.coerce.date({ error: "Data de demissão inválida" }).optional(),
    status: z.enum(["active", "terminated"]).default("active"),
});

export const updateFuncionarioSchema = createFuncionarioSchema.partial();

export type CreateFuncionarioInput = z.infer<typeof createFuncionarioSchema>;
export type UpdateFuncionarioInput = z.infer<typeof updateFuncionarioSchema>;
