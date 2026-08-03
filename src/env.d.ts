// Declaration merging: acrescenta os bindings que ainda não estão no
// worker-configuration.d.ts gerado. Depois de rodar `pnpm cf-typegen`
// (com o wrangler.json atualizado) estes campos passam a vir de lá também.
interface CloudflareBindings {
    // Segredo usado para assinar/verificar os JWT. Em produção use
    // `wrangler secret put JWT_SECRET`; em dev fica no wrangler.json (vars).
    JWT_SECRET: string;
    // Bucket R2 onde os arquivos de extrato são armazenados.
    BUCKET: R2Bucket;
    // Origens permitidas no CORS (CSV). Ex.: "https://app.exemplo.com,https://x.exemplo.com".
    // Vazio em dev → cai no allowlist de localhost. Definir em produção.
    CORS_ORIGINS?: string;
}
