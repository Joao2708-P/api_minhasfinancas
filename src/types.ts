import type { Database } from "./database";
import type { Permission, Role } from "./lib/permissions";

// Membro ativo resolvido pelo orgContext (organizacao_id + user_id, status active).
// `permissions` = conjunto EFETIVO já resolvido (papel customizado OU conjunto fixo
// do `role`). O `role` continua exposto porque governa o ESCOPO (planner→só seus
// clientes) e a invariante de owner, que são independentes das permissões.
export type ActiveMembro = { id: string; role: Role; user_id: string; permissions: Permission[] };

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
