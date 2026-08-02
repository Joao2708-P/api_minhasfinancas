import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../src/lib/jwt";

const SECRET = "segredo-de-teste";

describe("jwt", () => {
    it("assina e verifica, devolvendo o sub (userId)", async () => {
        const token = await signToken("user_123", SECRET);
        const payload = await verifyToken(token, SECRET);

        expect(payload.sub).toBe("user_123");
        expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("rejeita token assinado com outro segredo", async () => {
        const token = await signToken("user_123", SECRET);
        await expect(verifyToken(token, "outro-segredo")).rejects.toBeDefined();
    });

    it("rejeita token adulterado", async () => {
        const token = await signToken("user_123", SECRET);
        const tampered = token.slice(0, -3) + "aaa";
        await expect(verifyToken(tampered, SECRET)).rejects.toBeDefined();
    });
});
