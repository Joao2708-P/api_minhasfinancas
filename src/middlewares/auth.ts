import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { UnauthorizedError } from "../errors/errors";
import { verifyToken } from "../lib/jwt";
import { getAuthCookie } from "../lib/authCookie";

// Protege rotas: valida o JWT e injeta o `userId` no contexto. A partir daqui o id
// do usuário NUNCA vem do corpo/query da requisição — sempre do token.
//
// Fonte do token, nesta ordem:
//  1. cookie HttpOnly `auth_token` (novo padrão — imune a roubo por XSS);
//  2. header `Authorization: Bearer` (fallback durante a migração do front;
//     remover quando o dashboard parar de usar localStorage/Bearer).
export const authGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
    const token = getAuthCookie(c) ?? bearerToken(c);

    if (!token) {
        throw new UnauthorizedError("Token de autenticação ausente");
    }

    try {
        const payload = await verifyToken(token, c.env.JWT_SECRET);
        c.set("userId", payload.sub);
    } catch {
        throw new UnauthorizedError("Token inválido ou expirado");
    }

    await next();
};

function bearerToken(c: Context<AppEnv>): string | undefined {
    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) return undefined;
    return header.slice("Bearer ".length).trim();
}
