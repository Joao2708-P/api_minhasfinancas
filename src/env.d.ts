// Declaration merging: acrescenta os bindings que ainda não estão no
// worker-configuration.d.ts gerado. Depois de rodar `pnpm cf-typegen`
// (com o wrangler.json atualizado) estes campos passam a vir de lá também.
interface CloudflareBindings {
    // Segredo usado para assinar/verificar os JWT. Em produção use
    // `wrangler secret put JWT_SECRET`; em dev local fica no `.dev.vars`.
    JWT_SECRET: string;
    // Token do provisionamento: só quem tem esse segredo cria donos
    // (organizações + membro owner) via POST /admin/provision. Enquanto o
    // cadastro público está fechado, é O usuário (o vendedor) quem cadastra.
    // Em produção use `wrangler secret put ADMIN_TOKEN`; em dev local fica no `.dev.vars`.
    ADMIN_TOKEN: string;
    // Bucket R2 onde os arquivos de extrato são armazenados.
    BUCKET: R2Bucket;
    // Origens permitidas no CORS (CSV). Ex.: "https://app.exemplo.com,https://x.exemplo.com".
    // Vazio em dev → cai no allowlist de localhost. Definir em produção.
    CORS_ORIGINS?: string;
    // Chave da API do Resend (envio de e-mail transacional). Ausente → stub de log
    // (dev). Em produção use `wrangler secret put RESEND_API_KEY`.
    RESEND_API_KEY?: string;
    // Remetente dos e-mails. Ex.: "Minhas Finanças <no-reply@seudominio.com>".
    // Sem domínio verificado no Resend, use o padrão que só entrega ao dono da conta.
    EMAIL_FROM?: string;
    // URL pública do dashboard (front) — usada nos links dos e-mails (convite,
    // primeiro acesso). Ex.: "https://app.seudominio.com". Ausente → default local
    // (http://localhost:5173). Definir em produção quando a URL estiver fechada.
    APP_URL?: string;
    // Homologação SEM e-mail real: quando "true", POST /auth/forgot devolve o código
    // na resposta para completar o smoke test. NUNCA ligar em produção (vaza código).
    DEV_EXPOSE_CODES?: string;
}
