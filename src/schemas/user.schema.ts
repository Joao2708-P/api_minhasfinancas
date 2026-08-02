import { z } from "zod";

export const createUserSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    email: z.email("E-mail inválido"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    cpf: z.string().regex(/^\d{11}$/, "O CPF deve conter 11 dígitos"),
});

export const updateUserSchema = createUserSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
