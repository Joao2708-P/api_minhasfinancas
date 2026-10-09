import { z } from "zod";

// Chave de ingestão por cliente. org/cliente vêm do contexto, nunca do corpo.
export const createIngestKeySchema = z.object({
    name: z.string().min(1, "O nome da chave é obrigatório"),
});

export type CreateIngestKeyInput = z.infer<typeof createIngestKeySchema>;
