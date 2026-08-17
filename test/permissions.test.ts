import { describe, it, expect } from "vitest";
import {
    can,
    canWith,
    isPermission,
    resolvePermissions,
    ROLE_PERMISSIONS,
    PERMISSION_KEYS,
} from "../src/lib/permissions";

describe("RBAC — can()", () => {
    it("owner tem todas as permissões (inclusive billing)", () => {
        expect(can("owner", "org:billing")).toBe(true);
        expect(can("owner", "org:manage_members")).toBe(true);
        expect(can("owner", "finance:write")).toBe(true);
        expect(can("owner", "report:read")).toBe(true);
    });

    it("admin tem tudo MENOS billing", () => {
        expect(can("admin", "org:manage_members")).toBe(true);
        expect(can("admin", "org:branding")).toBe(true);
        expect(can("admin", "finance:write")).toBe(true);
        expect(can("admin", "org:billing")).toBe(false);
    });

    it("planner: escreve finanças, importa e lê relatórios; não gerencia membros nem branding", () => {
        expect(can("planner", "finance:read")).toBe(true);
        expect(can("planner", "finance:write")).toBe(true);
        expect(can("planner", "finance:import")).toBe(true);
        expect(can("planner", "report:read")).toBe(true);
        expect(can("planner", "org:manage_members")).toBe(false);
        expect(can("planner", "org:branding")).toBe(false);
    });

    it("viewer é somente leitura", () => {
        expect(can("viewer", "finance:read")).toBe(true);
        expect(can("viewer", "report:read")).toBe(true);
        expect(can("viewer", "client:read")).toBe(true);
        expect(can("viewer", "finance:write")).toBe(false);
        expect(can("viewer", "finance:import")).toBe(false);
        expect(can("viewer", "client:delete")).toBe(false);
    });

    it("owner tem estritamente mais permissões que admin (só billing os separa)", () => {
        const diff = ROLE_PERMISSIONS.owner.filter((p) => !ROLE_PERMISSIONS.admin.includes(p));
        expect(diff).toEqual(["org:billing"]);
    });
});

describe("RBAC — permissões configuráveis (resolvePermissions)", () => {
    it("sem papel customizado, cai no conjunto fixo do role (retrocompatível)", () => {
        expect(resolvePermissions("viewer", null)).toEqual(ROLE_PERMISSIONS.viewer);
        expect(resolvePermissions("planner", undefined)).toEqual(ROLE_PERMISSIONS.planner);
    });

    it("com papel customizado, usa exatamente as chaves do papel", () => {
        const perms = resolvePermissions("viewer", ["finance:read", "finance:write"]);
        expect(perms).toEqual(["finance:read", "finance:write"]);
        expect(canWith(perms, "finance:write")).toBe(true);
        expect(canWith(perms, "client:delete")).toBe(false);
    });

    it("papel customizado VAZIO = nenhuma permissão (não faz fallback pro role)", () => {
        expect(resolvePermissions("admin", [])).toEqual([]);
    });

    it("owner ignora o papel customizado e mantém tudo (blindagem anti-lockout)", () => {
        const perms = resolvePermissions("owner", []);
        expect(canWith(perms, "org:billing")).toBe(true);
        expect(canWith(perms, "org:manage_members")).toBe(true);
    });

    it("chaves fora do catálogo são descartadas", () => {
        const perms = resolvePermissions("viewer", ["finance:read", "nao:existe" as any]);
        expect(perms).toEqual(["finance:read"]);
    });

    it("isPermission valida contra o catálogo", () => {
        expect(isPermission("finance:read")).toBe(true);
        expect(isPermission("banana")).toBe(false);
        expect(PERMISSION_KEYS.length).toBeGreaterThan(0);
    });
});
