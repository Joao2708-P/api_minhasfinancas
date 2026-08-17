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

/* ------------------------------------------------------------------ */
/* Permissões configuráveis (papéis customizados por organização)      */
/* ------------------------------------------------------------------ */

// Catálogo FIXO de chaves válidas. Uma org configura QUAIS chaves cada papel
// customizado tem, mas não inventa chaves novas — isto evita conceder uma
// "permissão" que não corresponde a nenhuma checagem real no código.
const PERMISSION_CATALOG = new Set<Permission>(ALL);

// Lista pública do catálogo (para a tela de administração montar os checkboxes).
export const PERMISSION_KEYS: readonly Permission[] = ALL;

export function isPermission(key: string): key is Permission {
    return PERMISSION_CATALOG.has(key as Permission);
}

// Resolve o conjunto EFETIVO de permissões de um membro.
//   - owner: SEMPRE tudo. Blindagem contra auto-lockout — o dono não perde acesso
//     por causa de um papel customizado mal configurado (papel customizado é para
//     a equipe: "Contador Sênior", "Estagiário"; não para rebaixar o dono).
//   - `customKeys` presente (o membro tem papel customizado atribuído, mesmo que a
//     lista seja vazia = papel sem permissão nenhuma) → usa exatamente essas chaves,
//     filtrando as que não existem no catálogo (defensivo contra dado velho).
//   - senão (papel_id null) → cai no conjunto fixo do papel-base `role` (legado).
export function resolvePermissions(role: Role, customKeys?: readonly string[] | null): Permission[] {
    if (role === "owner") return [...ALL];
    if (customKeys) return customKeys.filter(isPermission);
    return ROLE_PERMISSIONS[role] ?? [];
}

// Checagem contra um conjunto já resolvido (usada no requirePermission).
export function canWith(perms: readonly Permission[], perm: Permission): boolean {
    return perms.includes(perm);
}
