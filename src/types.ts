import type { Database } from "./database";

// Ambiente único do app: bindings do Cloudflare + variáveis de contexto.
// `userId` é preenchido pelo middleware de autenticação (authGuard).
export type AppEnv = {
    Bindings: CloudflareBindings;
    Variables: {
        db: Database;
        userId: string;
    };
};
