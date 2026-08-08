import { z } from "zod";

// Ajuste do status de pagamento de uma org pelo painel da plataforma.
// `paid_until` é opcional (ex.: registrar até quando a assinatura está em dia).
export const setBillingSchema = z.object({
    billing_status: z.enum(["trial", "active", "past_due"]),
    paid_until: z.coerce.date().optional(),
});

export type SetBillingInput = z.infer<typeof setBillingSchema>;
