import type { Context } from 'hono';
import { updateUserSchema } from '../schemas/user.schema';
import { usersService } from '../services/users.service';
import { NotFoundError } from '../errors/errors';
import type { AppEnv } from '../types';

// Todas as operações são sobre o próprio usuário autenticado (do token).
export const userController = {
    async getMe(c: Context<AppEnv>) {
        const user = await usersService.findById(c.get('db'), c.get('userId'));
        if (!user) throw new NotFoundError('Usuário');

        return c.json(user);
    },

    async updateMe(c: Context<AppEnv>) {
        const body = updateUserSchema.parse(await c.req.json());

        const user = await usersService.update(c.get('db'), c.get('userId'), body);
        if (!user) throw new NotFoundError('Usuário');

        return c.json(user);
    },

    async deleteMe(c: Context<AppEnv>) {
        const deleted = await usersService.delete(c.get('db'), c.get('userId'));
        if (!deleted) throw new NotFoundError('Usuário');

        return c.json(deleted);
    },
};
