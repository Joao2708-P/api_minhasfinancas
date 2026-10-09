// Chave de API de ingestão (por cliente). O token é de alta entropia, então o hash
// é SHA-256 (rápido) — NÃO PBKDF2 (que só faz sentido para senhas de baixa entropia
// e tornaria cada request de ingestão lento). Guardamos apenas o hash; a chave crua
// é mostrada uma única vez na criação.

const PREFIX = "mfk_"; // "minhas finanças key" — ajuda a identificar/rotacionar

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

// Gera um token novo: prefixo + 32 bytes aleatórios em hex.
export function generateIngestKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return PREFIX + hex;
}

// Hash SHA-256 (hex) do token — o que guardamos e por onde autenticamos.
export async function hashIngestKey(raw: string): Promise<string> {
    const data = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
}

// Últimos 4 chars do token, para exibir na lista sem revelar o segredo.
export function last4(raw: string): string {
    return raw.slice(-4);
}
