import { z } from "zod";

// Papel customizado da org + as chaves de permissão que ele concede.
// As chaves são validadas contra o CATÁLOGO fixo no service (isPermission),
// não aqui — o Zod só garante o formato (lista de strings não vazias).
export const createPapelSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório").max(60, "Nome muito longo"),
    permissions: z.array(z.string().min(1)).default([]),
});

// Atualização parcial: renomear e/ou trocar o conjunto de permissões.
// `permissions` presente = substitui o conjunto inteiro (não faz merge).
export const updatePapelSchema = z
    .object({
        name: z.string().min(1).max(60).optional(),
        permissions: z.array(z.string().min(1)).optional(),
    })
    .refine((v) => v.name !== undefined || v.permissions !== undefined, {
        error: "Informe ao menos um campo (name ou permissions)",
    });

export type CreatePapelInput = z.infer<typeof createPapelSchema>;
export type UpdatePapelInput = z.infer<typeof updatePapelSchema>;
