import { describe, it, expect } from "vitest";
import { redact, serializeAuditSnapshot } from "../src/lib/audit";

describe("audit — redação de dados sensíveis", () => {
    it("redige senha/hash/token em qualquer nome (inglês e português)", () => {
        const out = redact({
            id: "u1",
            email: "a@b.com",
            password: "segredo",
            senha: "segredo",
            passwordHash: "abc:def",
            code_hash: "xxx",
            codigo_hash: "yyy",
            token: "jwt",
        }) as Record<string, unknown>;

        expect(out.email).toBe("a@b.com");
        expect(out.password).toBe("[REDACTED]");
        expect(out.senha).toBe("[REDACTED]");
        expect(out.passwordHash).toBe("[REDACTED]");
        expect(out.code_hash).toBe("[REDACTED]");
        expect(out.codigo_hash).toBe("[REDACTED]");
        expect(out.token).toBe("[REDACTED]");
    });

    it("redige em profundidade (objetos aninhados e arrays)", () => {
        const out = redact({
            user: { name: "Ana", password: "x" },
            list: [{ senha: "y", ok: 1 }],
        }) as any;

        expect(out.user.name).toBe("Ana");
        expect(out.user.password).toBe("[REDACTED]");
        expect(out.list[0].senha).toBe("[REDACTED]");
        expect(out.list[0].ok).toBe(1);
    });

    it("não muta o objeto de entrada", () => {
        const input = { password: "segredo", email: "a@b.com" };
        redact(input);
        expect(input.password).toBe("segredo");
    });

    it("preserva chaves não sensíveis com nomes parecidos", () => {
        const out = redact({ passwordChangedAt: 123, isSenhaForte: true }) as Record<string, unknown>;
        expect(out.passwordChangedAt).toBe(123);
        expect(out.isSenhaForte).toBe(true);
    });

    it("preserva Date (não vira {}) — snapshots de linhas Drizzle têm timestamps", () => {
        const d = new Date("2026-08-15T00:00:00.000Z");
        const out = redact({ id: "t1", date: d }) as Record<string, unknown>;
        expect(out.date).toBeInstanceOf(Date);
        expect((out.date as Date).getTime()).toBe(d.getTime());

        // E via serialização vira ISO string (não objeto vazio).
        const json = serializeAuditSnapshot({ date: d, senha: "x" });
        const parsed = JSON.parse(json as string);
        expect(parsed.date).toBe("2026-08-15T00:00:00.000Z");
        expect(parsed.senha).toBe("[REDACTED]");
    });
});

describe("audit — serializeAuditSnapshot", () => {
    it("retorna null para ausência de snapshot (criação/exclusão)", () => {
        expect(serializeAuditSnapshot(null)).toBeNull();
        expect(serializeAuditSnapshot(undefined)).toBeNull();
    });

    it("serializa JSON já redigido", () => {
        const json = serializeAuditSnapshot({ id: "t1", value: 100, senha: "x" });
        expect(json).not.toBeNull();
        const parsed = JSON.parse(json as string);
        expect(parsed).toEqual({ id: "t1", value: 100, senha: "[REDACTED]" });
    });
});
