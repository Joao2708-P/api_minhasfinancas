import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { cliente, membro } from "../database/schema";
import type { CreateClienteInput } from "../schemas";
import type { ActiveMembro } from "../types";
import { BadRequestError } from "../errors/errors";
import { assertMembroPodeAcessarCliente } from "../lib/tenant";

export const clienteService = {
    async create(db: Database, orgId: string, input: CreateClienteInput) {
        // Se informado, o responsável precisa ser um membro da MESMA org.
        if (input.responsavel_id) {
            const resp = await db.query.membro.findFirst({
                where: and(eq(membro.id, input.responsavel_id), eq(membro.organizacao_id, orgId)),
            });
            if (!resp) throw new BadRequestError("Responsável inválido (não é membro da organização)");
        }

        const [created] = await db
            .insert(cliente)
            .values({
                organizacao_id: orgId,
                name: input.name,
                responsavel_id: input.responsavel_id ?? null,
            })
            .returning();

        return created;
    },

    // owner/admin/viewer: todos os clientes da org. planner: só os seus.
    async listForMembro(db: Database, orgId: string, m: ActiveMembro) {
        const conditions = [eq(cliente.organizacao_id, orgId)];
        if (m.role === "planner") conditions.push(eq(cliente.responsavel_id, m.id));

        return db.query.cliente.findMany({ where: and(...conditions) });
    },

    // Busca um cliente da org aplicando a regra de acesso do membro.
    async findForMembro(db: Database, orgId: string, m: ActiveMembro, id: string) {
        const row = await db.query.cliente.findFirst({
            where: and(eq(cliente.id, id), eq(cliente.organizacao_id, orgId)),
        });
        if (!row) return undefined;

        assertMembroPodeAcessarCliente(m, row);
        return row;
    },
};
