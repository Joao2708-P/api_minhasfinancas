import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types";
import { users } from "../database/schema";
import { ForbiddenError } from "../errors/errors";

// Protege o painel da plataforma (/platform/*). Roda DEPOIS do authGuard (usa o
// userId do token) e exige que o usuário seja `platform_admin` — o dono da
// plataforma (você), que vê todas as orgs e o status de pagamento.
//
// É lido a CADA request: revogar o flag bloqueia na hora, independente do TTL do JWT.
export const platformAdminGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
    const db = c.get("db");
    const user = await db.query.users.findFirst({
        where: eq(users.id, c.get("userId")),
    });

    if (!user?.platformAdmin) {
        throw new ForbiddenError("Acesso restrito ao administrador da plataforma");
    }

    await next();
};
