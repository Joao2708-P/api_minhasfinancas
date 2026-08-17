#!/usr/bin/env node
// seed-admin.mjs — bootstrap do ADMIN da plataforma (o login do BI /platform/*).
//
// SÓ isso: cria o SEU usuário admin. Cliente/dono você cria depois pela própria
// plataforma, logado como admin — não é papel do seed.
//
// NÃO mexe no banco direto: fala com a API REST no ar (POST /admin/platform-admin).
//
// Pré-requisitos (você roda):
//   1. Migration aplicada num D1 novo:  pnpm db:migrate:local
//   2. API no ar:                       pnpm dev   (porta 8787)
//
// Uso (local — o caminho normal), DENTRO desta pasta (api_minhasfinancas):
//   pnpm seed:admin        (ou: node seed-admin.mjs)
//   → Sem env nenhuma: mira em http://localhost:8787 e lê o ADMIN_TOKEN do
//     .dev.vars (que está aqui do lado). Você NÃO precisa saber/colar token.
//
// Uso (outra API): API_URL=... ADMIN_TOKEN=... pnpm seed:admin
//
// Idempotente: se o admin já existe (409), só reporta e sai.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  EDITE AQUI: o SEU admin da plataforma (login do BI).                      │
// │  Ponha seus dados direto nestes 4 campos e rode `pnpm seed:admin`.         │
// └──────────────────────────────────────────────────────────────────────────┘
const ADMIN = {
    name: "João Guilherme",
    email: "joaoguilherme.2708@gmail.com",
    password: "minhasfinancas@06",
    cpf: "46545544837",
};
// ────────────────────────────────────────────────────────────────────────────

// ---- Resolução do ADMIN_TOKEN + alvo da API (acoplados) -----------------------
// No caminho normal eu leio o ADMIN_TOKEN do .dev.vars (o mesmo que o
// `wrangler dev` usa) e miro em localhost. Esse token do .dev.vars SÓ vale contra
// a API LOCAL — por isso, sem ADMIN_TOKEN no ambiente, eu travo o alvo em
// localhost:8787. Se você exportar ADMIN_TOKEN e API_URL, mando no que você mandar.
const PLACEHOLDER_TOKEN = "__SEM_ADMIN_TOKEN__";
const HERE = dirname(fileURLToPath(import.meta.url));
const DEV_VARS_PATH = resolve(HERE, ".dev.vars"); // mesmo diretório deste script

// Lê uma chave KEY=VALUE do .dev.vars (Node não tem dotenv embutido).
function readDevVar(key) {
    try {
        for (const line of readFileSync(DEV_VARS_PATH, "utf8").split(/\r?\n/)) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const eq = t.indexOf("=");
            if (eq !== -1 && t.slice(0, eq).trim() === key) return t.slice(eq + 1).trim();
        }
    } catch {
        // sem .dev.vars — segue sem
    }
    return null;
}
const isLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+|\b)/i.test(url);

const envToken = process.env.ADMIN_TOKEN;
const devToken = envToken ? null : readDevVar("ADMIN_TOKEN");
const tokenFromDevVars = !envToken && !!devToken; // token veio do .dev.vars (só vale local)
const ADMIN_TOKEN = envToken ?? devToken ?? PLACEHOLDER_TOKEN;
const API_URL = (
    process.env.API_URL ??
    (tokenFromDevVars ? "http://localhost:8787" : "https://minhas-financas-api.minhasfinancasapi.workers.dev")
).replace(/\/$/, "");

// ---- Helpers ------------------------------------------------------------------
async function api(path, { method = "GET", body, adminToken } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }
    return { status: res.status, ok: res.ok, data };
}

function die(msg, extra) {
    console.error(`\n❌ ${msg}`);
    if (extra !== undefined) console.error(JSON.stringify(extra, null, 2));
    process.exit(1);
}

// ---- Fluxo --------------------------------------------------------------------
async function main() {
    console.log(`→ API: ${API_URL}`);

    const ping = await api("/").catch(() => null);
    if (!ping || ping.status >= 500) {
        die(`Não consegui falar com a API em ${API_URL}. A API está no ar? (pnpm dev)`);
    }

    // Trava anti-401: o token do .dev.vars só vale contra a API LOCAL.
    if (tokenFromDevVars && !isLocal(API_URL)) {
        die(
            `Você está mirando ${API_URL}, mas o único ADMIN_TOKEN que eu conheço é o do .dev.vars,\n` +
                `   que só vale contra a API LOCAL (wrangler dev). Rode a API local (pnpm dev) e use a URL local,\n` +
                `   ou exporte ADMIN_TOKEN e API_URL de produção você mesmo.`
        );
    }
    if (ADMIN_TOKEN === PLACEHOLDER_TOKEN) {
        die(
            "Não achei o ADMIN_TOKEN em lugar nenhum (nem no ambiente, nem no .dev.vars).\n" +
                "   Suba a API local (pnpm dev), que ela usa o .dev.vars, ou exporte ADMIN_TOKEN você mesmo."
        );
    }

    // Cria o SEU admin da plataforma (o login do BI /platform/*).
    console.log(`\nCriando o admin da plataforma / BI (${ADMIN.email})...`);
    const res = await api("/admin/platform-admin", {
        method: "POST",
        adminToken: ADMIN_TOKEN,
        body: { name: ADMIN.name, email: ADMIN.email, cpf: ADMIN.cpf, password: ADMIN.password },
    });

    if (res.status === 201) {
        console.log("   ✓ Admin da plataforma criado — acesso ao BI liberado.");
    } else if (res.status === 409) {
        console.log("   • Admin da plataforma já existe — nada a fazer.");
    } else if (res.status === 401) {
        die(
            `A API em ${API_URL} recusou o ADMIN_TOKEN (401).\n` +
                `   Confira se é a API local (pnpm dev, com o .dev.vars) que está no ar.`,
            res.data
        );
    } else {
        die(`Falha ao criar o admin da plataforma (HTTP ${res.status}).`, res.data);
    }

    console.log("\n──────────────────────────────────────────────");
    console.log(" Admin da plataforma (painel do BI /platform/*):");
    console.log(`   e-mail:  ${ADMIN.email}`);
    console.log(`   senha:   ${ADMIN.password}`);
    console.log("──────────────────────────────────────────────");
}

main().catch((e) => die(`Erro inesperado: ${e?.message ?? e}`));
