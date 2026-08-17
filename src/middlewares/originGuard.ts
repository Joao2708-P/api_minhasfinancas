import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { getAllowedOrigins } from "../lib/allowlist";
import { ForbiddenError } from "../errors/errors";

// Proteção CSRF. Com o token agora em cookie `SameSite=None` (obrigatório no
// cross-site Pages↔Worker), o navegador passa a anexar o cookie automaticamente
// em requisições de outros sites — o vetor clássico de CSRF. Este guard barra
// requisições de ESCRITA cuja origem não está na allowlist.
//
// Por que não confiar só no preflight do CORS: `POST /extracts` é
// `multipart/form-data`, um content-type "simple" que o browser NÃO faz preflight
// → passaria batido. Checar o `Origin` aqui cobre também esse caso.
//
// Regras:
//  - Só métodos que mudam estado (POST/PUT/PATCH/DELETE). GET/HEAD/OPTIONS passam.
//  - `Origin` presente e fora da allowlist → 403.
//  - `Origin` ausente → passa: são clientes não-navegador (curl, app mobile) que
//    não carregam cookie ambiente, logo não são vetor de CSRF (e mantém o runbook
//    de curl funcionando).
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const originGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (UNSAFE.has(c.req.method)) {
        const origin = c.req.header("Origin");
        if (origin && !getAllowedOrigins(c.env).includes(origin)) {
            throw new ForbiddenError("Origem não permitida");
        }
    }
    await next();
};
