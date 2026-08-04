const INTERATIONS = 100_000

function toHex(buffer: ArrayBuffer): string {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
    }

    return bytes;
}

// Comparação de tempo constante: evita timing attack ao verificar a senha.
// O `===` de strings retorna cedo no 1º byte diferente, vazando informação.
// Exportada para reuso (ex.: comparar o ADMIN_TOKEN no adminGuard).
export function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16))

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: INTERATIONS, hash: 'SHA-256'},
        keyMaterial,
        256
    )

    return `${toHex(salt.buffer)}:${toHex(derivedBits)}`
}

export async function verifyPassword(password: string, stored: string): Promise<Boolean> {
    const [saltHex, hasHex] = stored.split(':')
    if(!saltHex || !hasHex) return false;

    const salt = fromHex(saltHex);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    )

    const derivedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: INTERATIONS, hash: 'SHA-256' },
        keyMaterial,
        256
    )

    return timingSafeEqual(toHex(derivedBits), hasHex)
}