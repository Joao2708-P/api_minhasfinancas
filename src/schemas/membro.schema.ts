import { z } from "zod";

// Convite/adição de membro por e-mail (o usuário precisa já existir).
// Não se cria 'owner' por convite — owner é quem cria a org.
export const createMembroSchema = z.object({
    email: z.email("E-mail inválido"),
    role: z.enum(["admin", "planner", "viewer"], { error: "Papel inválido" }),
});

// Alterar papel-base e/ou revogar acesso (status) e/ou atribuir papel customizado.
// 'invited' não é setado via API. `papel_id` null = remover o papel customizado
// (volta ao conjunto fixo do role).
export const updateMembroSchema = z
    .object({
        role: z.enum(["owner", "admin", "planner", "viewer"]).optional(),
        status: z.enum(["active", "revoked"]).optional(),
        papel_id: z.cuid2("Papel inválido").nullable().optional(),
    })
    .refine((v) => v.role !== undefined || v.status !== undefined || v.papel_id !== undefined, {
        error: "Informe ao menos um campo (role, status ou papel_id)",
    });

// Convidar/adicionar um membro à org. Se o e-mail já tem conta, só cria o vínculo
// (name/cpf ignorados). Se é um e-mail novo, cria a conta — aí `name` e `cpf` são
// obrigatórios (validado no service, não aqui, porque depende de o usuário existir).
// Papel 'owner' NÃO é criável por aqui (owner é quem cria a org).
export const inviteMembroSchema = z.object({
    email: z.email("E-mail inválido"),
    role: z.enum(["admin", "planner", "viewer"], { error: "Papel inválido" }),
    papel_id: z.cuid2("Papel inválido").optional(),
    name: z.string().min(1, "Nome muito curto").optional(),
    cpf: z.string().min(11, "CPF inválido").max(14).optional(),
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").optional(),
});

export type CreateMembroInput = z.infer<typeof createMembroSchema>;
export type UpdateMembroInput = z.infer<typeof updateMembroSchema>;
export type InviteMembroInput = z.infer<typeof inviteMembroSchema>;
