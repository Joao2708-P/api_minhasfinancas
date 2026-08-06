import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Database } from "../database";
import { users, organizacao, membro } from "../database/schema";
import type { ProvisionOwnerInput } from "../schemas/admin.schema";
import { ConflictError } from "../errors/errors";
import { hashPassword } from "../lib/password";

export const adminService = {
    // Cria o dono (usuário) + a organização + o vínculo owner num batch atômico.
    // É o caminho de provisionamento enquanto o cadastro público está fechado:
    // quem chama é a plataforma (ADMIN_TOKEN), não um usuário logado.
    async provisionOwner(db: Database, input: ProvisionOwnerInput) {
        const duplicateEmail = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });
        if (duplicateEmail) {
            throw new ConflictError("Esse e-mail já está cadastrado em nosso sistema!");
        }

        const duplicateCpf = await db.query.users.findFirst({
            where: eq(users.cpf, input.cpf),
        });
        if (duplicateCpf) {
            throw new ConflictError("Esse CPF já está cadastrado em nosso sistema!");
        }

        const passwordHash = await hashPassword(input.password);
        const userId = createId();
        const orgId = createId();

        // Ordem importa: usuário → organização (dono_id) → membro (owner).
        // db.batch é atômico no D1 — se qualquer passo falhar, nada é gravado.
        await db.batch([
            db.insert(users).values({
                id: userId,
                name: input.name,
                email: input.email,
                cpf: input.cpf,
                password: passwordHash,
            }),
            db.insert(organizacao).values({
                id: orgId,
                name: input.org_name,
                owner_id: userId,
            }),
            db.insert(membro).values({
                organizacao_id: orgId,
                user_id: userId,
                role: "owner",
                status: "active",
            }),
        ]);

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const org = await db.query.organizacao.findFirst({ where: eq(organizacao.id, orgId) });

        // Nunca devolve o hash da senha. O dono entra depois via POST /auth/login.
        const safeUser = user ? (({ password, ...rest }) => rest)(user) : null;

        return { user: safeUser, org };
    },
};
