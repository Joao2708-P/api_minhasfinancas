import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { organizacao, membro } from "../database/schema";
import type { CreateOrgInput } from "../schemas";

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

        return db.query.organizacao.findFirst({ where: eq(organizacao.id, orgId) });
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
};
