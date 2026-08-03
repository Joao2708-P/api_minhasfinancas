import { z } from "zod";

// organizacao_id vem do contexto (X-Org-Id), nunca do corpo.
// responsavel_id (opcional) é um `membro` da mesma org (validado no service).
export const createClienteSchema = z.object({
    name: z.string().min(1, "O nome do cliente é obrigatório"),
    responsavel_id: z.cuid2("Responsável inválido").optional(),
});

export const updateClienteSchema = createClienteSchema.partial();

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
