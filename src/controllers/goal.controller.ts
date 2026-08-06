import type { Context } from "hono";
import { createGoalSchema, updateGoalSchema } from "../schemas/goal.schema";
import { goalService, goalProgress } from "../services/goal.service";
import { NotFoundError } from "../errors/errors";
import type { AppEnv, Scope } from "../types";

const scopeOf = (c: Context<AppEnv>): Scope => ({
    orgId: c.get("organizacaoId"),
    clienteId: c.get("clienteId"),
});

function withProgress(g: { target_value: number; current_value: number }) {
    return { ...g, ...goalProgress(g.target_value, g.current_value) };
}

export const goalController = {
    async listGoals(c: Context<AppEnv>) {
        const goals = await goalService.listByScope(c.get("db"), scopeOf(c));
        return c.json(goals.map(withProgress));
    },

    async getGoalById(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const g = await goalService.findByIdOwned(c.get("db"), scopeOf(c), id);
        if (!g) throw new NotFoundError("Meta");

        return c.json(withProgress(g));
    },

    async createGoal(c: Context<AppEnv>) {
        const body = createGoalSchema.parse(await c.req.json());

        const g = await goalService.create(c.get("db"), scopeOf(c), body);
        return c.json(g, 201);
    },

    async updateGoal(c: Context<AppEnv>) {
        const id = c.req.param("id")!;
        const body = updateGoalSchema.parse(await c.req.json());
        const s = scopeOf(c);

        const existing = await goalService.findByIdOwned(c.get("db"), s, id);
        if (!existing) throw new NotFoundError("Meta");

        const g = await goalService.update(c.get("db"), s, id, body);
        return c.json(g);
    },

    async deleteGoal(c: Context<AppEnv>) {
        const id = c.req.param("id")!;

        const deleted = await goalService.delete(c.get("db"), scopeOf(c), id);
        if (!deleted) throw new NotFoundError("Meta");

        return c.json(deleted);
    },
};
