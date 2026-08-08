import { z } from "zod";

// organizacao_id vem do contexto (X-Org-Id), nunca do corpo.
// responsavel_id (opcional) é um `membro` da mesma org (validado no service).
export const createClienteSchema = z.object({
    name: z.string().min(1, "O nome do cliente é obrigatório"),
    responsavel_id: z.cuid2("Responsável inválido").optional(),
});

export const updateClienteSchema = createClienteSchema.partial();

// Cria o LOGIN de um cliente existente (portal). O nome vem do próprio cliente;
// aqui e-mail + CPF + senha OPCIONAL (se vazia, o sistema gera uma temporária).
// O cliente recebe um convite por e-mail com e-mail+senha e entra direto.
export const clienteAccessSchema = z.object({
    email: z.email("E-mail inválido"),
    cpf: z.string().regex(/^\d{11}$/, "O CPF deve conter 11 dígitos"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
export type ClienteAccessInput = z.infer<typeof clienteAccessSchema>;
