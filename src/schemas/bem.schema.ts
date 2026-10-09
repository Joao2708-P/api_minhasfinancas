import { z } from "zod";
import { ASSET_KINDS, INVESTMENT_CLASSES } from "../lib/assets";

const cents = (label: string) =>
    z
        .number({ error: `${label} é obrigatório` })
        .int(`${label} deve ser um inteiro (em centavos)`)
        .min(0, `${label} não pode ser negativo`);

// Bem/investimento do cliente. organizacao_id/cliente_id vêm do contexto de tenant.
const baseBemSchema = z.object({
    kind: z.enum(ASSET_KINDS, { error: "Tipo de bem inválido" }),
    investmentClass: z.enum(INVESTMENT_CLASSES, { error: "Classe de investimento inválida" }).nullish(),
    name: z.string().trim().min(1, "O nome é obrigatório"),
    institution: z.string().trim().nullish(),
    acquisitionValue: cents("O valor de aquisição"),
    acquiredAt: z.coerce.date({ error: "Data de aquisição inválida" }).nullish(),
    currentValue: cents("O valor atual"),
    valuedAt: z.coerce.date({ error: "Data da avaliação inválida" }).nullish(),
    notes: z.string().nullish(),
});

// Classe de investimento só faz sentido em kind='investment'.
const classOnlyForInvestment = (v: { kind?: string; investmentClass?: string | null }) =>
    !v.investmentClass || v.kind === undefined || v.kind === "investment";
const classMsg = { message: "Classe de investimento só se aplica a bens do tipo investimento", path: ["investmentClass"] };

export const createBemSchema = baseBemSchema.refine(classOnlyForInvestment, classMsg);
export const updateBemSchema = baseBemSchema.partial().refine(classOnlyForInvestment, classMsg);

export type CreateBemInput = z.infer<typeof createBemSchema>;
export type UpdateBemInput = z.infer<typeof updateBemSchema>;
