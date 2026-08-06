import { describe, it, expect } from "vitest";
import {
    assertClienteNaOrg,
    assertMembroPodeAcessarCliente,
} from "../src/lib/tenant";
import { ForbiddenError, NotFoundError } from "../src/errors/errors";
import type { Database } from "../src/database";

// db mockado só com o caminho usado por assertClienteNaOrg.
const mockDb = (row: unknown): Database =>
    ({ query: { cliente: { findFirst: async () => row } } }) as unknown as Database;

describe("assertClienteNaOrg", () => {
    it("retorna o cliente quando existe na org", async () => {
        const row = { id: "c1", organizacao_id: "o1", responsavel_id: null };
        await expect(assertClienteNaOrg(mockDb(row), "o1", "c1")).resolves.toBe(row);
    });

    it("lança NotFound quando o cliente não é da org (não vaza existência)", async () => {
        await expect(assertClienteNaOrg(mockDb(undefined), "o1", "cX")).rejects.toBeInstanceOf(
            NotFoundError,
        );
    });
});

describe("assertMembroPodeAcessarCliente", () => {
    const cliente = (responsavel_id: string | null) =>
        ({ id: "c1", organizacao_id: "o1", responsavel_id }) as never;

    it("planner acessa cliente do qual é responsável", () => {
        expect(() =>
            assertMembroPodeAcessarCliente({ id: "m1", role: "planner" }, cliente("m1")),
        ).not.toThrow();
    });

    it("planner NÃO acessa cliente de outro responsável (403)", () => {
        expect(() =>
            assertMembroPodeAcessarCliente({ id: "m1", role: "planner" }, cliente("m2")),
        ).toThrow(ForbiddenError);
    });

    it("owner/admin/viewer acessam qualquer cliente da org", () => {
        for (const role of ["owner", "admin", "viewer"] as const) {
            expect(() =>
                assertMembroPodeAcessarCliente({ id: "mX", role }, cliente("outro")),
            ).not.toThrow();
        }
    });
});
