import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { cliente } from "../database/schema";
import { ForbiddenError, NotFoundError } from "../errors/errors";
import type { Role } from "./permissions";

// Regra de acesso centralizada — não espalhar pelos services/controllers.

type MembroLike = { id: string; role: Role };
type ClienteRow = typeof cliente.$inferSelect;

// Garante que o cliente existe E pertence à org. Retorna a linha (reaproveitada
// pela checagem de responsável). NotFound (não vaza existência entre tenants).
export async function assertClienteNaOrg(
    db: Database,
    orgId: string,
    clienteId: string,
): Promise<ClienteRow> {
    const row = await db.query.cliente.findFirst({
        where: and(eq(cliente.id, clienteId), eq(cliente.organizacao_id, orgId)),
    });
    if (!row) throw new NotFoundError("Cliente");
    return row;
}

// owner/admin/viewer: qualquer cliente da org.
// planner: só onde `responsavel_id === membro.id`. Recebe a linha já buscada.
export function assertMembroPodeAcessarCliente(membro: MembroLike, clienteRow: ClienteRow): void {
    if (membro.role === "planner" && clienteRow.responsavel_id !== membro.id) {
        throw new ForbiddenError("Você não é responsável por este cliente");
    }
}
