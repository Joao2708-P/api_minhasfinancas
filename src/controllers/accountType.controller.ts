import type { Context } from 'hono';
import { createAccountTypeSchema, updateAccountTypeSchema } from '../schemas/accountType.schema';
import { AccountTypeService } from '../services/accountType.service';
import { NotFoundError } from '../errors/errors';
import type { AppEnv } from '../types';

type Env = AppEnv;

export const accountTypeController = {
    async listAccountTypes(c: Context<Env>) {
        const types = await AccountTypeService.list(c.get('db'));

        return c.json(types);
    },

    async getAccountTypeById(c: Context<Env>) {
        const id = c.req.param('id');

        if (id === undefined) return;

        const type = await AccountTypeService.findById(c.get('db'), id);
        if (!type) throw new NotFoundError('Tipo de conta');

        return c.json(type);
    },

    async createAccountType(c: Context<Env>) {
        const body = createAccountTypeSchema.parse(await c.req.json());

        const type = await AccountTypeService.create(c.get('db'), body);
        return c.json(type, 201);
    },

    async updateAccountType(c: Context<Env>) {
        const id = c.req.param('id');
        const body = updateAccountTypeSchema.parse(await c.req.json());

        if (id === undefined) return;

        const existing = await AccountTypeService.findById(c.get('db'), id);
        if (!existing) throw new NotFoundError('Tipo de conta');

        const type = await AccountTypeService.update(c.get('db'), id, body);

        return c.json(type);
    },

    async deleteAccountType(c: Context<Env>) {
        const id = c.req.param('id');

        if (id === undefined) return;

        const typeDelete = await AccountTypeService.delete(c.get('db'), id);
        if (!typeDelete) throw new NotFoundError('Tipo de conta');

        return c.json(typeDelete);
    },
}
