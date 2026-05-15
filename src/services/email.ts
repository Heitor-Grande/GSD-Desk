import nodemailer from "nodemailer";
import { consultarBancoDados } from "@/services/database";
import { descriptografarValor } from "@/utils/criptografiaReversivel";

type DadosEmail = {
    to: string;
    subject: string;
    html: string;
};

type ConfiguracaoSmtpBanco = {
    smtp_host: string | null;
    smtp_port: string | null;
    smtp_user: string | null;
    smtp_pass: string | null;
    smtp_from: string | null;
};

type ConfiguracaoSmtp = {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
};

/**
 * Carrega a configuração SMTP salva no banco e descriptografa os valores para uso interno.
 * Use em services server-side que precisam enviar e-mails transacionais.
 */
async function obterConfiguracaoSmtp(): Promise<ConfiguracaoSmtp> {
    const resultado = await consultarBancoDados<ConfiguracaoSmtpBanco>(
        `
            select
                smtp_host,
                smtp_port,
                smtp_user,
                smtp_pass,
                smtp_from
            from configuracao
            order by id
            limit 1
        `
    );

    const configuracao = resultado.rows[0];

    if (!configuracao) {
        throw new Error("Configuração SMTP não encontrada.");
    }

    const host = descriptografarValor(configuracao.smtp_host);
    const port = Number(descriptografarValor(configuracao.smtp_port));
    const user = descriptografarValor(configuracao.smtp_user);
    const pass = descriptografarValor(configuracao.smtp_pass);
    const from = descriptografarValor(configuracao.smtp_from);

    if (!host || !Number.isFinite(port) || port <= 0 || !user || !pass || !from) {
        throw new Error("Configuração SMTP incompleta.");
    }

    return {
        host: host,
        port: port,
        user: user,
        pass: pass,
        from: from,
    };
}

/**
 * Envia e-mails transacionais do template usando SMTP configurado no menu Configurações.
 * Use em rotas de API para centralizar host, porta, autenticação e remetente.
 */
export async function enviarEmail({
    to,
    subject,
    html,
}: DadosEmail): Promise<void> {
    const configuracao = await obterConfiguracaoSmtp();

    const transporter = nodemailer.createTransport({
        host: configuracao.host,
        port: configuracao.port,
        secure: configuracao.port === 465,
        auth: {
            user: configuracao.user,
            pass: configuracao.pass,
        },
    });

    await transporter.sendMail({
        from: configuracao.from,
        to: to,
        subject: subject,
        html: html,
    });
}
