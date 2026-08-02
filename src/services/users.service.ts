import { and, eq, ne } from 'drizzle-orm';
import type { Database } from '../database';
import { users } from '../database/schema';
import type { CreateUserInput, UpdateUserInput } from '../schemas';
import { ConflictError } from '../errors/errors';
import { hashPassword } from '../lib/password';

// Remove o hash de senha antes de devolver o usuário na resposta.
function toSafeUser<T extends { password: string }>(user: T) {
    const { password, ...safe } = user;
    return safe;
}

export const usersService = {
    async findById(db: Database, id: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, id),
        });

        return user ? toSafeUser(user) : undefined;
    },

    async create(db: Database, input: CreateUserInput) {
        const duplicate = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        if (duplicate) {
            throw new ConflictError('Esse email já está cadastrado em nosso sistema!');
        }

        const passwordHash = await hashPassword(input.password);

        const [user] = await db.insert(users).values({ ...input, password: passwordHash }).returning();

        return toSafeUser(user);
    },

    async update(db: Database, id: string, updateInput: UpdateUserInput) {
        // Impede colisão de e-mail com OUTRO usuário.
        if (updateInput.email) {
            const duplicate = await db.query.users.findFirst({
                where: and(eq(users.email, updateInput.email), ne(users.id, id)),
            });
            if (duplicate) {
                throw new ConflictError('Esse email já está cadastrado em nosso sistema!');
            }
        }

        // Nunca grava senha em texto puro: sempre hasheia quando informada.
        const values: Record<string, unknown> = { ...updateInput, updateAt: new Date() };
        if (updateInput.password) {
            values.password = await hashPassword(updateInput.password);
        }

        const [user] = await db
            .update(users)
            .set(values)
            .where(eq(users.id, id))
            .returning();

        return user ? toSafeUser(user) : undefined;
    },

    async delete(db: Database, id: string) {
        const [user] = await db
            .delete(users)
            .where(eq(users.id, id))
            .returning();

        return user ? toSafeUser(user) : undefined;
    },
};
