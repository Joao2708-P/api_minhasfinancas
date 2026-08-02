import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { goal } from "../database/schema";
import type { CreateGoalInput, UpdateGoalInput } from "../schemas";
import type { Scope } from "../types";

const inScope = (s: Scope) =>
    and(eq(goal.organizacao_id, s.orgId), eq(goal.cliente_id, s.clienteId));

export const goalService = {
    async findByIdOwned(db: Database, s: Scope, id: string) {
        return db.query.goal.findFirst({
            where: and(eq(goal.id, id), inScope(s)),
        });
    },

    async listByScope(db: Database, s: Scope) {
        return db.query.goal.findMany({ where: inScope(s) });
    },

    async create(db: Database, s: Scope, input: CreateGoalInput) {
        const [created] = await db
            .insert(goal)
            .values({ ...input, organizacao_id: s.orgId, cliente_id: s.clienteId })
            .returning();

        return created;
    },

    async update(db: Database, s: Scope, id: string, input: UpdateGoalInput) {
        const [updated] = await db
            .update(goal)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(goal.id, id), inScope(s)))
            .returning();

        return updated;
    },

    async delete(db: Database, s: Scope, id: string) {
        const [deleted] = await db
            .delete(goal)
            .where(and(eq(goal.id, id), inScope(s)))
            .returning();

        return deleted;
    },
};

// Progresso da meta (0 a 1) + valor que falta, em centavos.
export function goalProgress(target: number, current: number) {
    const ratio = target > 0 ? current / target : 0;
    return {
        progress: Math.min(1, Math.max(0, ratio)),
        remaining: Math.max(0, target - current),
    };
}
