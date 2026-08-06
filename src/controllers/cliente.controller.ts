import type { Context } from "hono";
import { createClienteSchema } from "../schemas";
import { clienteService } from "../services/cliente.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv } from "../types";

// Rotas sob orgContext: org de X-Org-Id + membro ativo do contexto.
export const clienteController = {
    async listClientes(c: Context<AppEnv>) {
        const clientes = await clienteService.listForMembro(
            c.get("db"),
            c.get("organizacaoId"),
            c.get("membro"),
        );
        return c.json(clientes);
    },

    async createCliente(c: Context<AppEnv>) {
        const body = createClienteSchema.parse(await c.req.json());
        const created = await clienteService.create(c.get("db"), c.get("organizacaoId"), body);
        return c.json(created, 201);
    },

    async getClienteById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const row = await clienteService.findForMembro(
            c.get("db"),
            c.get("organizacaoId"),
            c.get("membro"),
            id,
        );
        if (!row) throw new NotFoundError("Cliente");
        return c.json(row);
    },
};
