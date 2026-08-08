import { describe, it, expect } from "vitest";
import {
    generateCode,
    codeExpiry,
    isCodeUsable,
    CODE_TTL_MS,
} from "../src/lib/accessCode";

describe("accessCode", () => {
    it("gera código numérico de 6 dígitos (com zeros à esquerda)", () => {
        for (let i = 0; i < 200; i++) {
            expect(generateCode()).toMatch(/^\d{6}$/);
        }
    });

    it("codeExpiry fica CODE_TTL_MS à frente do agora", () => {
        const now = new Date("2026-01-01T00:00:00Z");
        expect(codeExpiry(now).getTime()).toBe(now.getTime() + CODE_TTL_MS);
    });

    it("código não usado e não expirado é utilizável", () => {
        const now = new Date();
        const row = { usedAt: null, expiresAt: new Date(now.getTime() + 1000) };
        expect(isCodeUsable(row, now)).toBe(true);
    });

    it("código já usado não é utilizável", () => {
        const now = new Date();
        const row = { usedAt: now, expiresAt: new Date(now.getTime() + 1000) };
        expect(isCodeUsable(row, now)).toBe(false);
    });

    it("código expirado não é utilizável", () => {
        const now = new Date();
        const row = { usedAt: null, expiresAt: new Date(now.getTime() - 1000) };
        expect(isCodeUsable(row, now)).toBe(false);
    });
});
