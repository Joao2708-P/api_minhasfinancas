import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { cliente, membro, users } from "../database/schema";
import type { CreateClienteInput, ClienteAccessInput } from "../schemas";
import type { ActiveMembro } from "../types";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/errors";
import { assertMembroPodeAcessarCliente } from "../lib/tenant";
import { hashPassword, generateTempPassword } from "../lib/password";
import { sendInvite, type EmailConfig } from "../lib/email";

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

    // Cria o LOGIN (portal) de um cliente existente: cria o `users` com senha (dada
    // ou gerada) e vincula em cliente.usuario_id. O cliente recebe um convite por
    // e-mail com e-mail+senha e entra direto; a resposta devolve a senha p/ repasse.
    async createAccess(db: Database, orgId: string, clienteId: string, input: ClienteAccessInput, emailConfig: EmailConfig) {
        const clienteRow = await db.query.cliente.findFirst({
            where: and(eq(cliente.id, clienteId), eq(cliente.organizacao_id, orgId)),
        });
        if (!clienteRow) throw new NotFoundError("Cliente");
        if (clienteRow.user_id) throw new ConflictError("Este cliente já tem acesso ao portal");

        const duplicateEmail = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });
        if (duplicateEmail) throw new ConflictError("Esse e-mail já está cadastrado em nosso sistema!");

        const duplicateCpf = await db.query.users.findFirst({
            where: eq(users.cpf, input.cpf),
        });
        if (duplicateCpf) throw new ConflictError("Esse CPF já está cadastrado em nosso sistema!");

        const password = input.password ?? generateTempPassword();
        const passwordHash = await hashPassword(password);
        const userId = createId();

        await db.batch([
            db.insert(users).values({
                id: userId,
                name: clienteRow.name,
                email: input.email,
                cpf: input.cpf,
                password: passwordHash,
            }),
            db.update(cliente).set({ user_id: userId, updateAt: new Date() }).where(eq(cliente.id, clienteId)),
        ]);

        await sendInvite({ to: input.email, email: input.email, password }, emailConfig);

        return { cliente_id: clienteId, user_id: userId, email: input.email, password };
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
