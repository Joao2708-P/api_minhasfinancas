import { eq } from "drizzle-orm";
import type { Database } from "../database";
import { users } from "../database/schema";
import type { CreateUserInput } from "../schemas";
import type { LoginInput } from "../schemas/auth.schema";
import { ConflictError, UnauthorizedError } from "../errors/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import { signToken } from "../lib/jwt";

export const authService = {
    async register(db: Database, secret: string, input: CreateUserInput) {
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

        const [user] = await db
            .insert(users)
            .values({ ...input, password: passwordHash })
            .returning();

        const { password, ...safeUser } = user;
        const token = await signToken(user.id, secret);

        return { user: safeUser, token };
    },

    async login(db: Database, secret: string, input: LoginInput) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        // Mensagem genérica de propósito: não revela se o e-mail existe.
        const invalid = new UnauthorizedError("E-mail ou senha inválidos");

        if (!user) throw invalid;

        const ok = await verifyPassword(input.password, user.password);
        if (!ok) throw invalid;

        const { password, ...safeUser } = user;
        const token = await signToken(user.id, secret);

        return { user: safeUser, token };
    },
};
