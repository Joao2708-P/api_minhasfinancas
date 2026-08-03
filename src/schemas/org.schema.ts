import { z } from "zod";

// owner_id/status vêm do contexto/servidor, não do corpo.
// Campos de branding (§1.2) ficam para quando o schema ganhar essas colunas.
export const createOrgSchema = z.object({
    name: z.string().min(1, "O nome da organização é obrigatório"),
});

export const updateOrgSchema = createOrgSchema.partial();

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
