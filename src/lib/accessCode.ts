// Geração/validação de código de acesso (primeiro acesso + recuperação de senha).
// Lógica pura, testável sem D1. O armazenamento (tabela `codigo_acesso`) e o envio
// (lib/email) ficam no auth.service; aqui só o que é determinístico/puro.

// Código numérico de 6 dígitos (000000–999999), com zeros à esquerda.
export function generateCode(): string {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    return n.toString().padStart(6, "0");
}

// TTL padrão do código: 15 minutos.
export const CODE_TTL_MS = 15 * 60 * 1000;

export function codeExpiry(now: Date = new Date()): Date {
    return new Date(now.getTime() + CODE_TTL_MS);
}

// Um código é utilizável se ainda não foi usado E não expirou.
export function isCodeUsable(
    row: { usedAt: Date | null; expiresAt: Date },
    now: Date = new Date(),
): boolean {
    if (row.usedAt) return false;
    return row.expiresAt.getTime() > now.getTime();
}
