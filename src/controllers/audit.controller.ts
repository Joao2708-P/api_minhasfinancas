import type { Context } from "hono";
import { listAuditByOrg, type AuditListOptions } from "../services/audit.service";
import type { AppEnv } from "../types";

// Leitura da trilha de auditoria da org ativa (X-Org-Id). Sob orgContext +
// org:manage_members (visibilidade administrativa).
export const auditController = {
    async list(c: Context<AppEnv>) {
        const opts: AuditListOptions = {};

        const entity = c.req.query("entity");
        const entityId = c.req.query("entity_id");
        if (entity) opts.entity = entity;
        if (entityId) opts.entity_id = entityId;

        const limit = Number(c.req.query("limit"));
        const offset = Number(c.req.query("offset"));
        if (Number.isInteger(limit) && limit > 0 && limit <= 500) opts.limit = limit;
        if (Number.isInteger(offset) && offset > 0) opts.offset = offset;

        const rows = await listAuditByOrg(c.get("db"), c.get("organizacaoId"), opts);
        return c.json(rows);
    },
};
