import { z } from "zod";

// owner_id/status vêm do contexto/servidor, não do corpo.
// Campos de branding (§1.2) ficam para quando o schema ganhar essas colunas.
export const createOrgSchema = z.object({
    name: z.string().min(1, "O nome da organização é obrigatório"),
});

export const updateOrgSchema = createOrgSchema.partial();

// White-label (§1.2). Todos opcionais; ao menos um deve vir.
export const updateBrandingSchema = z
    .object({
        brand_name: z.string().min(1).optional(),
        logo_key: z.string().min(1).optional(),
        primary_color: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)")
            .optional(),
        subdomain: z
            .string()
            .regex(/^[a-z0-9-]+$/, "Subdomínio: só minúsculas, números e hífen")
            .min(1)
            .optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { error: "Informe ao menos um campo" });

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
