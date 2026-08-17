import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../database";
import { logAuditoria } from "../database/schema";
import { serializeAuditSnapshot, type AuditEntryInput } from "../lib/audit";

// Grava um evento na trilha de auditoria. Chamado pelos services LOGO APÓS a
// escrita bem-sucedida (create/update/delete), passando as linhas antes/depois.
//
// Best-effort (mesmo espírito do envio de e-mail em lib/email.ts): uma falha ao
// gravar o log NÃO derruba a operação de negócio já concluída — seria pior falhar
// um pagamento porque o log caiu. A falha é logada para investigação. Se um dia a
// auditoria virar requisito de compliance "fail-closed", trocar aqui por incluir o
// insert no mesmo `db.batch([...])` da escrita (atômico) em vez deste after-write.
export async function recordAudit(db: Database, entry: AuditEntryInput): Promise<void> {
    try {
        await db.insert(logAuditoria).values({
            organizacao_id: entry.organizacao_id,
            cliente_id: entry.cliente_id ?? null,
            user_id: entry.user_id,
            action: entry.action,
            entity: entry.entity,
            entity_id: entry.entity_id,
            before: serializeAuditSnapshot(entry.before),
            after: serializeAuditSnapshot(entry.after),
        });
    } catch (err) {
        console.error("[audit] falha ao gravar log de auditoria", {
            entity: entry.entity,
            entity_id: entry.entity_id,
            action: entry.action,
            err,
        });
    }
}

export type AuditListOptions = {
    entity?: string;
    entity_id?: string;
    limit?: number;
    offset?: number;
};

// Lista a trilha de auditoria da org (mais recente primeiro), com filtros opcionais
// por entidade/registro. SEMPRE escopada por organizacao_id — nunca vaza log entre
// tenants. `before`/`after` continuam como JSON string (o front faz o parse).
export async function listAuditByOrg(db: Database, orgId: string, opts: AuditListOptions = {}) {
    const conditions = [eq(logAuditoria.organizacao_id, orgId)];
    if (opts.entity) conditions.push(eq(logAuditoria.entity, opts.entity));
    if (opts.entity_id) conditions.push(eq(logAuditoria.entity_id, opts.entity_id));

    return db.query.logAuditoria.findMany({
        where: and(...conditions),
        orderBy: [desc(logAuditoria.createdAt)],
        limit: opts.limit ?? 100,   // teto padrão para não devolver a tabela inteira
        offset: opts.offset,
    });
}
