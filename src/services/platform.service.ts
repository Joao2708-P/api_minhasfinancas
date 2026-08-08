import { and, count, eq } from "drizzle-orm";
import type { Database } from "../database";
import { organizacao, users, cliente, membro } from "../database/schema";
import type { SetBillingInput } from "../schemas/platform.schema";
import { NotFoundError } from "../errors/errors";

export const platformService = {
    // Todas as organizações com dono, status de pagamento e contagens — a visão
    // do dono da plataforma ("quem são meus clientes e quem pagou").
    async listOrgs(db: Database) {
        const orgs = await db
            .select({
                id: organizacao.id,
                name: organizacao.name,
                status: organizacao.status,
                billing_status: organizacao.billing_status,
                paid_until: organizacao.paid_until,
                createdAt: organizacao.createdAt,
                owner_name: users.name,
                owner_email: users.email,
            })
            .from(organizacao)
            .innerJoin(users, eq(organizacao.owner_id, users.id));

        // Contagens por org (clientes ativos e membros ativos), agregadas — sem N+1.
        const clientCounts = await db
            .select({ orgId: cliente.organizacao_id, total: count() })
            .from(cliente)
            .where(eq(cliente.status, "ativo"))
            .groupBy(cliente.organizacao_id);

        const memberCounts = await db
            .select({ orgId: membro.organizacao_id, total: count() })
            .from(membro)
            .where(eq(membro.status, "active"))
            .groupBy(membro.organizacao_id);

        const clientsBy = new Map(clientCounts.map((r) => [r.orgId, Number(r.total)]));
        const membersBy = new Map(memberCounts.map((r) => [r.orgId, Number(r.total)]));

        return orgs.map((o) => ({
            ...o,
            clientCount: clientsBy.get(o.id) ?? 0,
            memberCount: membersBy.get(o.id) ?? 0,
        }));
    },

    // Alterna/ajusta o status de pagamento de uma org (o "pagou ou não").
    async setBilling(db: Database, orgId: string, input: SetBillingInput) {
        const org = await db.query.organizacao.findFirst({
            where: eq(organizacao.id, orgId),
        });
        if (!org) throw new NotFoundError("Organização");

        const [updated] = await db
            .update(organizacao)
            .set({
                billing_status: input.billing_status,
                paid_until: input.paid_until ?? null,
                updateAt: new Date(),
            })
            .where(eq(organizacao.id, orgId))
            .returning();

        return updated;
    },
};
