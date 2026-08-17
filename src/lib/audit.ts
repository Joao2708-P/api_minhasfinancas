// Log de auditoria — lógica PURA (serialização + redação de dados sensíveis).
// O acesso ao banco fica no `services/audit.service.ts`; aqui só o que é testável
// sem D1, para poder cobrir com teste de unidade a parte mais fácil de errar:
// NUNCA vazar senha/hash para dentro do log.

// Ação registrada. Espelha o enum da coluna `acao` em `log_auditoria`.
export type AuditAction = "criado" | "atualizado" | "excluido";

// Chaves que jamais podem ir para o log, em qualquer profundidade do objeto.
// Cobrem os nomes em inglês (propriedades do Drizzle) e em português (colunas),
// já que um snapshot pode vir de qualquer um dos dois lados.
const REDACTED_KEYS = new Set<string>([
    "password",
    "senha",
    "passwordHash",
    "password_hash",
    "code_hash",
    "codigo_hash",
    "token",
]);

const REDACTED_MARK = "[REDACTED]";

// Serializa um snapshot (linha antes/depois) para JSON string, redigindo campos
// sensíveis. Retorna `null` para ausência de snapshot (criação não tem "antes",
// exclusão não tem "depois") — casa com as colunas nullable `dados_antes`/`dados_depois`.
export function serializeAuditSnapshot(data: unknown): string | null {
    if (data === null || data === undefined) return null;
    return JSON.stringify(redact(data));
}

// Redação recursiva: troca o VALOR das chaves sensíveis por um marcador, sem
// remover a chave (assim o diff antes/depois continua legível). Não muta a entrada.
export function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact);
    // Date é `typeof "object"`: sem este guard, o loop abaixo iteraria Object.entries
    // de um Date (→ {}) e apagaria timestamps como `criado_em`/`data` do snapshot.
    // Preservado como Date → JSON.stringify emite a string ISO.
    if (value instanceof Date) return value;
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            out[key] = REDACTED_KEYS.has(key) ? REDACTED_MARK : redact(val);
        }
        return out;
    }
    return value;
}

// Dados necessários para registrar um evento. `before`/`after` são as linhas cruas
// (o service serializa/redige via as funções acima). Ver `AuditContext` no service.
export type AuditEntryInput = {
    organizacao_id: string;
    cliente_id?: string | null;
    user_id: string;
    action: AuditAction;
    entity: string;        // nome lógico da entidade, ex.: "transacao", "membro"
    entity_id: string;
    before?: unknown;      // linha antes (null/ausente em criação)
    after?: unknown;       // linha depois (null/ausente em exclusão)
};
