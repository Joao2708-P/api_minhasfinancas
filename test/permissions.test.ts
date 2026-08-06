import { describe, it, expect } from "vitest";
import { can, ROLE_PERMISSIONS } from "../src/lib/permissions";

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
