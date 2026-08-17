import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { papel, papelPermissao } from "../database/schema";
import type { CreatePapelInput, UpdatePapelInput } from "../schemas";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/errors";
import { isPermission, PERMISSION_KEYS, type Permission } from "../lib/permissions";
import { recordAudit } from "./audit.service";

// Filtra a lista recebida para as chaves QUE EXISTEM no catálogo. Chave inválida
// derruba a requisição (BadRequest) em vez de ser silenciosamente ignorada — assim
// o admin percebe erro de digitação em vez de criar um papel que não faz o esperado.
function assertValidPermissions(keys: string[]): Permission[] {
    const invalid = keys.filter((k) => !isPermission(k));
    if (invalid.length) throw new BadRequestError(`Permissão(ões) inválida(s): ${invalid.join(", ")}`);
    // Dedup preservando o catálogo como fonte de ordem.
    return PERMISSION_KEYS.filter((p) => keys.includes(p));
}

export const papelService = {
    // Catálogo fixo de chaves (para a tela de administração montar os checkboxes).
    catalog(): readonly Permission[] {
        return PERMISSION_KEYS;
    },

    // Papéis customizados da org, cada um com suas chaves de permissão.
    async listByOrg(db: Database, orgId: string) {
        const papeis = await db.query.papel.findMany({
            where: eq(papel.organizacao_id, orgId),
            with: { permissoes: true },
        });
        return papeis.map((p) => ({
            id: p.id,
            name: p.name,
            createdAt: p.createdAt,
            permissions: p.permissoes.map((perm) => perm.permission_key),
        }));
    },

    async create(db: Database, orgId: string, input: CreatePapelInput, actorUserId: string) {
        const permissions = assertValidPermissions(input.permissions);

        // Pré-checagem do nome único por org: devolve ConflictError (como o resto do
        // código) em vez de deixar o índice único estourar como 500 cru.
        const duplicate = await db.query.papel.findFirst({
            where: and(eq(papel.organizacao_id, orgId), eq(papel.name, input.name)),
        });
        if (duplicate) throw new ConflictError("Já existe um papel com esse nome nesta organização");

        const [created] = await db
            .insert(papel)
            .values({ organizacao_id: orgId, name: input.name })
            .returning();

        if (permissions.length) {
            await db.insert(papelPermissao).values(
                permissions.map((key) => ({ papel_id: created.id, permission_key: key })),
            );
        }

        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "criado", entity: "papel", entity_id: created.id,
            after: { name: created.name, permissions },
        });

        return { id: created.id, name: created.name, createdAt: created.createdAt, permissions };
    },

    async update(db: Database, orgId: string, papelId: string, input: UpdatePapelInput, actorUserId: string) {
        const existing = await db.query.papel.findFirst({
            where: and(eq(papel.id, papelId), eq(papel.organizacao_id, orgId)),
            with: { permissoes: true },
        });
        if (!existing) throw new NotFoundError("Papel");

        const before = {
            name: existing.name,
            permissions: existing.permissoes.map((p) => p.permission_key),
        };

        if (input.name !== undefined && input.name !== existing.name) {
            const duplicate = await db.query.papel.findFirst({
                where: and(eq(papel.organizacao_id, orgId), eq(papel.name, input.name)),
            });
            if (duplicate) throw new ConflictError("Já existe um papel com esse nome nesta organização");
        }
        if (input.name !== undefined) {
            await db.update(papel).set({ name: input.name, updateAt: new Date() }).where(eq(papel.id, papelId));
        }

        // `permissions` presente substitui o conjunto INTEIRO (apaga e reinsere).
        let permissions = before.permissions;
        if (input.permissions !== undefined) {
            permissions = assertValidPermissions(input.permissions);
            await db.delete(papelPermissao).where(eq(papelPermissao.papel_id, papelId));
            if (permissions.length) {
                await db.insert(papelPermissao).values(
                    permissions.map((key) => ({ papel_id: papelId, permission_key: key })),
                );
            }
        }

        const after = { name: input.name ?? before.name, permissions };

        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "atualizado", entity: "papel", entity_id: papelId, before, after,
        });

        return { id: papelId, ...after };
    },

    async remove(db: Database, orgId: string, papelId: string, actorUserId: string) {
        const existing = await db.query.papel.findFirst({
            where: and(eq(papel.id, papelId), eq(papel.organizacao_id, orgId)),
        });
        if (!existing) throw new NotFoundError("Papel");

        // Apagar o papel: os membros que o usavam voltam ao conjunto fixo do role
        // (membro.papel_id → null por `onDelete: set null`); papel_permissao cai por cascade.
        await db.delete(papel).where(eq(papel.id, papelId));

        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "excluido", entity: "papel", entity_id: papelId,
            before: { name: existing.name },
        });

        return { id: papelId };
    },
};
