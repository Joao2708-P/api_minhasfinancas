// Origens permitidas — fonte única usada tanto pelo CORS quanto pelo originGuard
// (CSRF). Vêm de CORS_ORIGINS (CSV, não-secreto); vazio → cai no allowlist de dev
// (Vite). Manter os dois consumidores na mesma lista evita divergência.
const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];

export function getAllowedOrigins(env: { CORS_ORIGINS?: string }): string[] {
    const configured = (env.CORS_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return configured.length ? configured : DEV_ORIGINS;
}
