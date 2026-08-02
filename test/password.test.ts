import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";

describe("password (PBKDF2)", () => {
    it("gera hash no formato salt:hash e valida a senha correta", async () => {
        const hash = await hashPassword("senha12345");

        expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
        expect(await verifyPassword("senha12345", hash)).toBe(true);
    });

    it("rejeita senha incorreta", async () => {
        const hash = await hashPassword("senha12345");
        expect(await verifyPassword("senhaErrada", hash)).toBe(false);
    });

    it("usa salt aleatório (hashes diferentes para a mesma senha)", async () => {
        const a = await hashPassword("igual");
        const b = await hashPassword("igual");
        expect(a).not.toBe(b);
    });

    it("retorna false para hash malformado", async () => {
        expect(await verifyPassword("x", "semdoispontos")).toBe(false);
    });
});
