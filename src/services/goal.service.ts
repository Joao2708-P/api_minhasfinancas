import { and, eq } from "drizzle-orm";
import type { Database } from "../database";
import { goal } from "../database/schema";
import type { CreateGoalInput, UpdateGoalInput } from "../schemas";

export const goalService = {
    async findByIdOwned(db: Database, userId: string, id: string) {
        return db.query.goal.findFirst({
            where: and(eq(goal.id, id), eq(goal.user_id, userId)),
        });
    },

    async listByUser(db: Database, userId: string) {
        return db.query.goal.findMany({
            where: eq(goal.user_id, userId),
        });
    },

    async create(db: Database, userId: string, input: CreateGoalInput) {
        const [created] = await db
            .insert(goal)
            .values({ ...input, user_id: userId })
            .returning();

        return created;
    },

    async update(db: Database, userId: string, id: string, input: UpdateGoalInput) {
        const [updated] = await db
            .update(goal)
            .set({ ...input, updateAt: new Date() })
            .where(and(eq(goal.id, id), eq(goal.user_id, userId)))
            .returning();

        return updated;
    },

    async delete(db: Database, userId: string, id: string) {
        const [deleted] = await db
            .delete(goal)
            .where(and(eq(goal.id, id), eq(goal.user_id, userId)))
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
