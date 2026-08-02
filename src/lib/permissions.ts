// RBAC — enum de permissões + mapa por papel + checagem `can()`.
// Checa-se PERMISSÃO (não papel) nos guards, pra ajustar regra sem reescrever.

export type Permission =
    | "org:manage_members"
    | "org:branding"
    | "org:billing"
    | "client:create"
    | "client:read"
    | "client:update"
    | "client:delete"
    | "finance:read"
    | "finance:write"
    | "finance:import"
    | "report:read";

// = enum de `membro.papel`. O cliente do portal NÃO é membro e fica fora daqui
// (recebe um conjunto fixo e estreito via portalContext — Fase 5).
export type Role = "owner" | "admin" | "planner" | "viewer";

const ALL: Permission[] = [
    "org:manage_members",
    "org:branding",
    "org:billing",
    "client:create",
    "client:read",
    "client:update",
    "client:delete",
    "finance:read",
    "finance:write",
    "finance:import",
    "report:read",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    // Dono: tudo.
    owner: ALL,
    // Braço direito: tudo menos billing (e não exclui a org).
    admin: ALL.filter((p) => p !== "org:billing"),
    // Planejador: leitura/escrita financeira — só dos clientes onde é responsável
    // (o escopo por-cliente é imposto por `assertMembroPodeAcessarCliente`).
    planner: ["client:read", "finance:read", "finance:write", "finance:import", "report:read"],
    // Somente leitura.
    viewer: ["client:read", "finance:read", "report:read"],
};

export function can(role: Role, perm: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}
