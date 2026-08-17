import { z } from "zod";

// organizacao_id/cliente_id vêm do contexto (headers de tenant), nunca do corpo.
export const createParceiroSchema = z.object({
    name: z.string().min(1, "O nome é obrigatório"),
    document: z.string().min(1).optional(),   // CPF ou CNPJ
    type: z.enum(["cliente", "fornecedor", "ambos"], { error: "Tipo inválido" }),
    email: z.email("E-mail inválido").optional(),
    phone: z.string().min(1).optional(),
});

export const updateParceiroSchema = createParceiroSchema.partial();

export type CreateParceiroInput = z.infer<typeof createParceiroSchema>;
export type UpdateParceiroInput = z.infer<typeof updateParceiroSchema>;
