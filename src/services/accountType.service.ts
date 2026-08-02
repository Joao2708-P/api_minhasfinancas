import { and, eq, ne } from "drizzle-orm";
import type { Database } from "../database";
import { accountType } from "../database/schema";
import type { CreateAccountTypeInput, UpdateAccountTypeInput } from "../schemas";
import { ConflictError } from "../errors/errors";

export const AccountTypeService = {
    async findById(db: Database, id: string) {
        return db.query.accountType.findFirst({
            where: eq(accountType.id, id),
        });
    },

    async list(db: Database) {
        return db.query.accountType.findMany();
    },

    async create(db: Database, input: CreateAccountTypeInput) {
        const duplicate = await db.query.accountType.findFirst({
            where: eq(accountType.name, input.name),
        });

        if (duplicate) {
            throw new ConflictError('Já existe um tipo de conta com esse nome!');
        }

        const [type] = await db.insert(accountType).values(input).returning();

        return type;
    },

    async update(db: Database, id: string, updateInput: UpdateAccountTypeInput) {
        if (updateInput.name) {
            const duplicate = await db.query.accountType.findFirst({
                where: and(
                    eq(accountType.name, updateInput.name),
                    ne(accountType.id, id),
                ),
            });

            if (duplicate) {
                throw new ConflictError('Já existe um tipo de conta com esse nome!');
            }
        }

        const [type] = await db
            .update(accountType)
            .set({ ...updateInput, updateAt: new Date() })
            .where(eq(accountType.id, id))
            .returning();

        return type;
    },

    async delete(db: Database, id: string) {
        const [type] = await db
            .delete(accountType)
            .where(eq(accountType.id, id))
            .returning();

        return type;
    },
};
