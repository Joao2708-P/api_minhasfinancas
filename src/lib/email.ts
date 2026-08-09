// Envio de e-mail transacional — interface única + backend Resend (com fallback stub).
//
// Em produção/homologação o envio real usa a API HTTP do Resend (https://resend.com):
// basta um `RESEND_API_KEY` e um `EMAIL_FROM` (remetente). Sem a chave, cai num STUB
// que apenas LOGA no console do Worker — suficiente para dev local sem domínio/DKIM.
//
// A entrega é BEST-EFFORT: uma falha de e-mail NUNCA derruba o fluxo de negócio
// (provisionamento/reset já commitaram no banco). Mas a falha é LOGADA de forma
// barulhenta (status HTTP + corpo da resposta do Resend), pois em fluxos como o
// "esqueci a senha" o log é a única observabilidade — a resposta é genérica de propósito.

export type AccessCodePurpose = "first_access" | "reset";

// Config de e-mail resolvida a partir do env (ver `emailConfigFromEnv`). É passada
// pelos controllers → services → aqui, no mesmo padrão do `JWT_SECRET`.
export interface EmailConfig {
    apiKey?: string;   // RESEND_API_KEY — ausente => stub de log (dev).
    from: string;      // EMAIL_FROM — ex.: "Minhas Finanças <no-reply@seudominio.com>".
}

// Remetente compartilhado do Resend: funciona SEM verificar domínio, mas só entrega
// para o e-mail dono da conta Resend. Bom para o primeiro teste; troque por um
// remetente de domínio verificado para enviar a terceiros.
const DEFAULT_FROM = "Minhas Finanças <onboarding@resend.dev>";

export function emailConfigFromEnv(env: {
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
}): EmailConfig {
    return {
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM?.trim() || DEFAULT_FROM,
    };
}

// Dispara um e-mail pelo Resend. Best-effort: retorna true/false, nunca lança.
async function deliver(
    config: EmailConfig,
    to: string,
    subject: string,
    html: string,
    text: string,
): Promise<boolean> {
    // Sem chave => stub de dev: só loga (não é erro).
    if (!config.apiKey) {
        console.log(`[email:stub] -> ${to} | ${subject}\n${text}`);
        return false;
    }

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: config.from, to, subject, html, text }),
        });

        if (!res.ok) {
            // Barulhento: sem isso, um reset "bem-sucedido" some sem e-mail chegar.
            const body = await res.text().catch(() => "");
            console.error(`[email:resend] FALHA ${res.status} -> ${to} | ${subject} | ${body}`);
            return false;
        }
        return true;
    } catch (err) {
        console.error(`[email:resend] ERRO de rede -> ${to} | ${subject} | ${String(err)}`);
        return false;
    }
}

export interface SendAccessCodeInput {
    to: string;
    code: string;
    purpose: AccessCodePurpose;
}

const ASSUNTO: Record<AccessCodePurpose, string> = {
    first_access: "Seu código de primeiro acesso",
    reset: "Seu código de recuperação de senha",
};

// Envia o código de acesso/recuperação. Best-effort (não lança).
export async function sendAccessCode(input: SendAccessCodeInput, config: EmailConfig): Promise<void> {
    const subject = ASSUNTO[input.purpose];
    const intro =
        input.purpose === "first_access"
            ? "Use o código abaixo para definir sua senha e acessar sua conta:"
            : "Use o código abaixo para redefinir sua senha:";
    const text = `${intro}\n\n${input.code}\n\nO código expira em breve. Se você não solicitou, ignore este e-mail.`;
    const html = `<p>${intro}</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${input.code}</p><p>O código expira em breve. Se você não solicitou, ignore este e-mail.</p>`;
    await deliver(config, input.to, subject, html, text);
}

export interface SendInviteInput {
    to: string;
    email: string;
    password: string;
    orgName?: string;   // marca/organização exibida no convite (white-label)
}

// Convite de primeiro acesso: manda ao cliente o e-mail + a senha para ele entrar.
// Best-effort (não lança) — o chamador também devolve a senha na resposta como fallback.
export async function sendInvite(input: SendInviteInput, config: EmailConfig): Promise<void> {
    const marca = input.orgName ? ` na ${input.orgName}` : "";
    const subject = `Seu acesso${marca}`;
    const text = `Sua conta foi criada.\n\nE-mail: ${input.email}\nSenha: ${input.password}\n\nRecomendamos trocar a senha no primeiro acesso.`;
    const html = `<p>Sua conta foi criada.</p><p><b>E-mail:</b> ${input.email}<br/><b>Senha:</b> ${input.password}</p><p>Recomendamos trocar a senha no primeiro acesso.</p>`;
    await deliver(config, input.to, subject, html, text);
}
