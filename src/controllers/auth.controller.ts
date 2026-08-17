import type { Context } from "hono";
import { loginSchema, forgotSchema, verifyCodeSchema, resetSchema } from "../schemas/auth.schema";
import { authService, resolveAccountType } from "../services/auth.service";
import { emailConfigFromEnv } from "../lib/email";
import { setAuthCookie, clearAuthCookie } from "../lib/authCookie";
import type { AppEnv } from "../types";

export const authController = {
    // Cadastro público FECHADO: donos são provisionados via POST /admin/provision.
    // `authService.register` fica preservado para quando o self-service reabrir.

    async login(c: Context<AppEnv>) {
        const body = loginSchema.parse(await c.req.json());

        const result = await authService.login(
            c.get("db"),
            c.env.JWT_SECRET,
            body,
            emailConfigFromEnv(c.env),
        );

        // Login bem-sucedido → grava o token no cookie HttpOnly. O fluxo de
        // primeiro acesso (`mustReset`) não emite token, então não seta cookie.
        if ("token" in result && result.token) setAuthCookie(c, result.token);

        return c.json(result);
    },

    // "Esqueci minha senha" / primeiro acesso. Resposta genérica (não revela se o
    // e-mail existe); se existir, um código é enviado ao e-mail.
    async forgot(c: Context<AppEnv>) {
        const body = forgotSchema.parse(await c.req.json());

        const code = await authService.forgot(
            c.get("db"),
            body.email,
            emailConfigFromEnv(c.env),
        );

        const payload: { message: string; code?: string } = {
            message: "Se o e-mail existir, enviamos um código para redefinir a senha.",
        };
        // Homologação sem e-mail real: expõe o código para completar o smoke test.
        // NUNCA ligar em produção (vaza o código e a existência do e-mail).
        if (c.env.DEV_EXPOSE_CODES === "true" && code) payload.code = code;

        return c.json(payload);
    },

    // Etapa 1: valida o código (sem consumir). Front libera a tela de nova senha.
    async verifyCode(c: Context<AppEnv>) {
        const body = verifyCodeSchema.parse(await c.req.json());

        const result = await authService.verifyCode(c.get("db"), body);

        return c.json(result);
    },

    // Etapa 2: redefine a senha com o código e já autentica (devolve { user, token }).
    async reset(c: Context<AppEnv>) {
        const body = resetSchema.parse(await c.req.json());

        const result = await authService.reset(c.get("db"), c.env.JWT_SECRET, body);

        // reset já autentica (auto-login) → grava o cookie de sessão.
        setAuthCookie(c, result.token);

        return c.json(result);
    },

    // Logout: apaga o cookie de sessão. Idempotente e público (não exige auth).
    async logout(c: Context<AppEnv>) {
        clearAuthCookie(c);
        return c.json({ ok: true });
    },

    // Retorna o usuário autenticado a partir do token (rota protegida).
    async me(c: Context<AppEnv>) {
        const userId = c.get("userId");
        const user = await c.get("db").query.users.findFirst({
            where: (u, { eq }) => eq(u.id, userId),
        });

        if (!user) return c.json({ error: { code: "NOT_FOUND", message: "Usuário não encontrado" } }, 404);

        const { password, ...safeUser } = user;
        const accountType = await resolveAccountType(c.get("db"), user);
        return c.json({ ...safeUser, accountType });
    },
};
