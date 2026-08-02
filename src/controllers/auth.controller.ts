import type { Context } from "hono";
import { createUserSchema } from "../schemas/user.schema";
import { loginSchema } from "../schemas/auth.schema";
import { authService } from "../services/auth.service";
import type { AppEnv } from "../types";

export const authController = {
    async register(c: Context<AppEnv>) {
        const body = createUserSchema.parse(await c.req.json());

        const result = await authService.register(c.get("db"), c.env.JWT_SECRET, body);

        return c.json(result, 201);
    },

    async login(c: Context<AppEnv>) {
        const body = loginSchema.parse(await c.req.json());

        const result = await authService.login(c.get("db"), c.env.JWT_SECRET, body);

        return c.json(result);
    },

    // Retorna o usuário autenticado a partir do token (rota protegida).
    async me(c: Context<AppEnv>) {
        const userId = c.get("userId");
        const user = await c.get("db").query.users.findFirst({
            where: (u, { eq }) => eq(u.id, userId),
        });

        if (!user) return c.json({ error: { code: "NOT_FOUND", message: "Usuário não encontrado" } }, 404);

        const { password, ...safeUser } = user;
        return c.json(safeUser);
    },
};
