import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { UnauthorizedError } from "../errors/errors";
import { verifyToken } from "../lib/jwt";

// Protege rotas: exige `Authorization: Bearer <token>`, valida o JWT e
// injeta o `userId` no contexto. A partir daqui o id do usuário NUNCA vem
// do corpo/query da requisição — sempre do token.
export const authGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
    const header = c.req.header("Authorization");

    if (!header || !header.startsWith("Bearer ")) {
        throw new UnauthorizedError("Token de autenticação ausente");
    }

    const token = header.slice("Bearer ".length).trim();

    try {
        const payload = await verifyToken(token, c.env.JWT_SECRET);
        c.set("userId", payload.sub);
    } catch {
        throw new UnauthorizedError("Token inválido ou expirado");
    }

    await next();
};
