import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { organizacao } from "../database/schema";
import { NotFoundError } from "../errors/errors";
import type { AppEnv } from "../types";

// Portal do cliente. O contexto (organizacaoId/clienteId) já foi resolvido pelo
// portalContext a partir do vínculo cliente.usuario_id = userId.
export const portalController = {
    // Identidade do portal: o cliente logado + a marca (white-label) da org, para
    // o front pintar a tela sob a identidade do contador/investidor.
    async me(c: Context<AppEnv>) {
        const db = c.get("db");
        const clienteId = c.get("clienteId");
        const orgId = c.get("organizacaoId");

        const clienteRow = await db.query.cliente.findFirst({
            where: (cl, { eq: e }) => e(cl.id, clienteId),
        });
        if (!clienteRow) throw new NotFoundError("Cliente");

        const org = await db.query.organizacao.findFirst({
            where: eq(organizacao.id, orgId),
            columns: { id: true, name: true, brand_name: true, logo_key: true, primary_color: true },
        });

        return c.json({ cliente: clienteRow, org });
    },
};
