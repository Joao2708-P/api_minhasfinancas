import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { TooManyRequestsError } from "../errors/errors";

// Freio de força-bruta nos endpoints de auth usando o Rate Limiting nativo do
// Cloudflare (binding declarado em wrangler.json → `ratelimits`). O binding é
// config-only: NÃO exige criar namespace via CLI, só redeploy.
//
// Chave = IP + e-mail. Assim um atacante não escapa só trocando de e-mail (o IP
// segura) nem só de IP (o e-mail alvo segura), e um NAT compartilhado não bloqueia
// todo mundo por causa de um usuário. A resposta é 429 genérica — não revela se o
// e-mail existe (mantém o mesmo sigilo do login/forgot).
export function rateLimit(pick: (env: AppEnv["Bindings"]) => RateLimit): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        const limiter = pick(c.env);

        // Fail-open: se o binding não estiver disponível (ex.: algum ambiente que
        // não simula o Rate Limiting), NÃO derruba o auth — só não freia. Um
        // limiter ausente virar 500 em todo login seria pior que não ter limite.
        if (!limiter || typeof limiter.limit !== "function") {
            await next();
            return;
        }

        const ip = clientIp(c);
        const email = await bodyEmail(c);
        const key = `${ip}:${email}`;

        const { success } = await limiter.limit({ key });
        if (!success) throw new TooManyRequestsError();

        await next();
    };
}

// IP real do cliente atrás do proxy da Cloudflare. Fallback fixo para dev local
// (onde o header pode faltar) — nunca fica vazio, senão a chave colapsaria.
function clientIp(c: Context<AppEnv>): string {
    return c.req.header("CF-Connecting-IP") ?? "local";
}

// Lê o e-mail do corpo sem quebrar o controller: `c.req.json()` é cacheado pelo
// Hono, então a re-leitura no controller reaproveita o mesmo parse. Corpo ausente
// ou inválido → string vazia (a chave vira só o IP).
async function bodyEmail(c: Context<AppEnv>): Promise<string> {
    try {
        const body = (await c.req.json()) as { email?: unknown };
        return typeof body?.email === "string" ? body.email.toLowerCase() : "";
    } catch {
        return "";
    }
}
