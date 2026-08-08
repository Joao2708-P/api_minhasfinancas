import { z } from "zod";

// Provisionamento de um dono (investidor/contador) + a organização dele, num
// passo só. Campos do usuário + o nome da organização. IDs e papéis NÃO entram:
// o papel é sempre 'owner' (definido no service), nunca vem do corpo.
// A SENHA é OPCIONAL: se você informar, é essa; se não, o sistema gera uma
// temporária. Nos dois casos o cliente recebe um convite por e-mail com e-mail+senha.
export const provisionOwnerSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    email: z.email("E-mail inválido"),
    cpf: z.string().regex(/^\d{11}$/, "O CPF deve conter 11 dígitos"),
    org_name: z.string().min(1, "O nome da organização é obrigatório"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").optional(),
});

export type ProvisionOwnerInput = z.infer<typeof provisionOwnerSchema>;

// Bootstrap do administrador da PLATAFORMA (você). Sem org: é um papel acima do
// tenant. Também sem senha — define no primeiro acesso via código.
export const provisionPlatformAdminSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    email: z.email("E-mail inválido"),
    cpf: z.string().regex(/^\d{11}$/, "O CPF deve conter 11 dígitos"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").optional(),
});

export type ProvisionPlatformAdminInput = z.infer<typeof provisionPlatformAdminSchema>;
