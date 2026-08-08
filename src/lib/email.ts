// Envio de e-mail transacional — interface única + stub de dev.
//
// Por ora o "envio" é um stub que apenas LOGA o código no console do Worker
// (suficiente para testar ponta a ponta na apresentação, sem domínio/DKIM).
// O e-mail real (Cloudflare Email Service — ver skill `cloudflare-email-service`)
// pluga atrás desta mesma interface depois, sem tocar nos services.

export type AccessCodePurpose = "first_access" | "reset";

export interface SendAccessCodeInput {
    to: string;
    code: string;
    purpose: AccessCodePurpose;
}

const ASSUNTO: Record<AccessCodePurpose, string> = {
    first_access: "Seu código de primeiro acesso",
    reset: "Seu código de recuperação de senha",
};

// Stub de dev: loga o código. Retorna para o chamador poder, em dev, devolvê-lo.
export async function sendAccessCode(input: SendAccessCodeInput): Promise<void> {
    const assunto = ASSUNTO[input.purpose];
    console.log(
        `[email:stub] -> ${input.to} | ${assunto} | código: ${input.code}`,
    );
}

export interface SendInviteInput {
    to: string;
    email: string;
    password: string;
    orgName?: string;   // marca/organização exibida no convite (white-label)
}

// Convite de primeiro acesso: manda ao cliente o e-mail + a senha para ele entrar.
// (Stub de dev: loga. Cloudflare Email Service pluga atrás da mesma interface depois.)
export async function sendInvite(input: SendInviteInput): Promise<void> {
    console.log(
        `[email:stub] convite -> ${input.to} | acesse com e-mail: ${input.email} | senha: ${input.password}`,
    );
}
