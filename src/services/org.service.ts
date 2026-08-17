import { and, eq, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { organizacao, membro } from "../database/schema";
import type { CreateOrgInput, UpdateBrandingInput } from "../schemas";
import { ConflictError } from "../errors/errors";
import { recordAudit } from "./audit.service";

export const orgService = {
    // Cria a org e o vínculo owner do criador num batch atômico.
    async create(db: Database, userId: string, input: CreateOrgInput) {
        const orgId = createId();

        await db.batch([
            db.insert(organizacao).values({ id: orgId, name: input.name, owner_id: userId }),
            db.insert(membro).values({
                organizacao_id: orgId,
                user_id: userId,
                role: "owner",
                status: "active",
            }),
        ]);

        const created = await db.query.organizacao.findFirst({ where: eq(organizacao.id, orgId) });

        await recordAudit(db, {
            organizacao_id: orgId, user_id: userId,
            action: "criado", entity: "organizacao", entity_id: orgId, after: created,
        });

        return created;
    },

    // Organizações onde o usuário é membro ativo (para o front escolher a org ativa).
    async listMine(db: Database, userId: string) {
        return db
            .select({
                id: organizacao.id,
                name: organizacao.name,
                status: organizacao.status,
                role: membro.role,
                membroId: membro.id,
            })
            .from(membro)
            .innerJoin(organizacao, eq(membro.organizacao_id, organizacao.id))
            .where(and(eq(membro.user_id, userId), eq(membro.status, "active")));
    },

    // Atualiza a identidade visual (white-label) da org ativa.
    async updateBranding(db: Database, orgId: string, input: UpdateBrandingInput, actorUserId: string) {
        if (input.subdomain) {
            const taken = await db.query.organizacao.findFirst({
                where: and(eq(organizacao.subdomain, input.subdomain), ne(organizacao.id, orgId)),
            });
            if (taken) throw new ConflictError("Subdomínio já está em uso");
        }

        const before = await db.query.organizacao.findFirst({ where: eq(organizacao.id, orgId) });

        const [updated] = await db
            .update(organizacao)
            .set({ ...input, updateAt: new Date() })
            .where(eq(organizacao.id, orgId))
            .returning();

        await recordAudit(db, {
            organizacao_id: orgId, user_id: actorUserId,
            action: "atualizado", entity: "organizacao", entity_id: orgId, before, after: updated,
        });

        return updated;
    },

    // Público: resolve a org pelo subdomínio (para o portal pintar a marca).
    async findBySubdomain(db: Database, subdomain: string) {
        return db.query.organizacao.findFirst({
            where: eq(organizacao.subdomain, subdomain),
        });
    },
};
