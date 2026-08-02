import type { Database } from "./database";
import type { Role } from "./lib/permissions";

// Membro ativo resolvido pelo orgContext (organizacao_id + user_id, status active).
export type ActiveMembro = { id: string; role: Role; user_id: string };

// Escopo de tenant repassado aos services de dados financeiros.
export type Scope = { orgId: string; clienteId: string };

// Ambiente do app: bindings do Cloudflare + variáveis de contexto.
// - `userId`: do authGuard (sempre presente nas rotas protegidas).
// - `organizacaoId` + `membro`: do orgContext (rotas de org).
// - `clienteId`: do clienteScope (rotas de dados financeiros por cliente).
export type AppEnv = {
    Bindings: CloudflareBindings;
    Variables: {
        db: Database;
        userId: string;
        organizacaoId: string;
        membro: ActiveMembro;
        clienteId: string;
    };
};
