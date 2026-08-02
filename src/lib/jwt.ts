import { sign, verify } from "hono/jwt";

// Duração do token: 7 dias (em segundos).
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export type TokenPayload = {
    sub: string;      // id do usuário
    exp: number;      // expiração (epoch em segundos)
};

export async function signToken(userId: string, secret: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const payload: TokenPayload = {
        sub: userId,
        exp: now + TOKEN_TTL_SECONDS,
    };

    return sign(payload, secret);
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
    // `verify` já lança se o token estiver expirado ou com assinatura inválida.
    const payload = await verify(token, secret, "HS256");
    return payload as unknown as TokenPayload;
}
