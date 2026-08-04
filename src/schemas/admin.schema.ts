import { z } from "zod";

// Provisionamento de um dono (investidor/contador) + a organização dele, num
// passo só. Campos do usuário + o nome da organização. IDs e papéis NÃO entram:
// o papel é sempre 'owner' (definido no service), nunca vem do corpo.
export const provisionOwnerSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    email: z.email("E-mail inválido"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    cpf: z.string().regex(/^\d{11}$/, "O CPF deve conter 11 dígitos"),
    org_name: z.string().min(1, "O nome da organização é obrigatório"),
});

export type ProvisionOwnerInput = z.infer<typeof provisionOwnerSchema>;
