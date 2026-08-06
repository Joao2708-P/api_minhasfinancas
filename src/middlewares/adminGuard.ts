import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { UnauthorizedError } from "../errors/errors";
import { timingSafeEqual } from "../lib/password";

// Protege as rotas de provisionamento (/admin/*). Enquanto o cadastro público
// está fechado, só quem tem o ADMIN_TOKEN (o dono da plataforma — o vendedor)
// pode criar organizações + donos. O token vem no header
// `Authorization: Bearer <ADMIN_TOKEN>` e é comparado em tempo constante.
//
// NÃO usa authGuard: o provisionamento é anterior a existir qualquer usuário,
// então é autenticado pelo segredo da plataforma, não por um JWT de usuário.
export const adminGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
    const expected = c.env.ADMIN_TOKEN;

    // Guarda de configuração: sem ADMIN_TOKEN, o endpoint fica fechado
    // (nunca "aberto por omissão").
    if (!expected) {
        throw new UnauthorizedError("Provisionamento indisponível");
    }

    const header = c.req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
        throw new UnauthorizedError("Token de administração ausente");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!timingSafeEqual(token, expected)) {
        throw new UnauthorizedError("Token de administração inválido");
    }

    await next();
};
