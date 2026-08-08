import { z } from "zod";

export const loginSchema = z.object({
    email: z.email("E-mail inválido"),
    password: z.string().min(1, "A senha é obrigatória"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// "Esqueci minha senha" / primeiro acesso: só o e-mail. A resposta é sempre 200
// (não revela se o e-mail existe).
export const forgotSchema = z.object({
    email: z.email("E-mail inválido"),
});

export type ForgotInput = z.infer<typeof forgotSchema>;

// Etapa 1: validar o código (sem trocar a senha ainda).
export const verifyCodeSchema = z.object({
    email: z.email("E-mail inválido"),
    code: z.string().regex(/^\d{6}$/, "O código deve ter 6 dígitos"),
});

export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

// Etapa 2: e-mail + código validado + nova senha.
export const resetSchema = z.object({
    email: z.email("E-mail inválido"),
    code: z.string().regex(/^\d{6}$/, "O código deve ter 6 dígitos"),
    password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});

export type ResetInput = z.infer<typeof resetSchema>;
