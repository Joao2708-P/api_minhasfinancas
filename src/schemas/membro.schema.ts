import { z } from "zod";

// Convite/adição de membro por e-mail (o usuário precisa já existir).
// Não se cria 'owner' por convite — owner é quem cria a org.
export const createMembroSchema = z.object({
    email: z.email("E-mail inválido"),
    role: z.enum(["admin", "planner", "viewer"], { error: "Papel inválido" }),
});

// Alterar papel e/ou revogar acesso (status). 'invited' não é setado via API.
export const updateMembroSchema = z
    .object({
        role: z.enum(["owner", "admin", "planner", "viewer"]).optional(),
        status: z.enum(["active", "revoked"]).optional(),
    })
    .refine((v) => v.role !== undefined || v.status !== undefined, {
        error: "Informe ao menos um campo (role ou status)",
    });

export type CreateMembroInput = z.infer<typeof createMembroSchema>;
export type UpdateMembroInput = z.infer<typeof updateMembroSchema>;
