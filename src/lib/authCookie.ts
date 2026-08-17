import type { Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { TOKEN_TTL_SECONDS } from "./jwt";

// Nome do cookie de sessão. Centralizado para authGuard e controller não divergirem.
export const AUTH_COOKIE = "auth_token";

// Política SameSite do cookie, configurável por env (COOKIE_SAMESITE):
//  - "Lax" (DEFAULT): correto quando front e API compartilham o domínio
//    registrável (ex.: app.seudominio.com + api.seudominio.com). O cookie é
//    same-site → funciona no Safari e não sofre bloqueio de cookie de terceiros.
//  - "None": necessário ENQUANTO front (Pages) e API (Worker) estiverem em
//    domínios distintos (pages.dev ↔ workers.dev). ⚠️ Cookie de terceiros: o
//    Safari (ITP) bloqueia sempre e o Chrome/Firefox bloqueiam com a proteção
//    ligada — só use como paliativo até subir o domínio próprio.
// Em ambos os casos o originGuard cobre CSRF nos métodos de escrita.
function cookieSameSite(c: Context<AppEnv>): "Lax" | "None" | "Strict" {
    const v = c.env.COOKIE_SAMESITE;
    return v === "None" || v === "Strict" ? v : "Lax";
}

// Grava o JWT num cookie de sessão endurecido:
//  - HttpOnly: o JS do front NÃO lê o token → tira o vetor de roubo por XSS.
//  - Secure: só trafega por HTTPS (aceito em http://localhost, então dev funciona).
//  - SameSite: ver cookieSameSite acima.
//  - Path=/ + maxAge = TTL do token, para o cookie e o JWT expirarem juntos.
export function setAuthCookie(c: Context<AppEnv>, token: string): void {
    setCookie(c, AUTH_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: cookieSameSite(c),
        path: "/",
        maxAge: TOKEN_TTL_SECONDS,
    });
}

export function clearAuthCookie(c: Context<AppEnv>): void {
    // Os atributos precisam bater com os do set para o browser apagar o cookie.
    deleteCookie(c, AUTH_COOKIE, { path: "/", secure: true, sameSite: cookieSameSite(c) });
}

export function getAuthCookie(c: Context<AppEnv>): string | undefined {
    return getCookie(c, AUTH_COOKIE);
}
