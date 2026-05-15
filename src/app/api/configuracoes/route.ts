import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { criptografarValor, descriptografarValor } from "@/utils/criptografiaReversivel";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { validarEmail, validarStringComConteudo } from "@/utils/validacoes";

type ConfiguracaoAplicacaoBanco = {
    id: number;
    fantasia: string;
    cnpj: string;
    email_suporte_contato: string;
    contato: string;
    disponibilidade: string;
    smtp_host: string | null;
    smtp_port: string | null;
    smtp_user: string | null;
    smtp_pass: string | null;
    smtp_from: string | null;
    criado_em: Date;
    atualizado_em: Date;
};

type ConfiguracaoAplicacao = Omit<
    ConfiguracaoAplicacaoBanco,
    "smtp_host" | "smtp_port" | "smtp_user" | "smtp_pass" | "smtp_from"
> & {
    smtp_host: string;
    smtp_port: string;
    smtp_user: string;
    smtp_pass: string;
    smtp_from: string;
};

type AtualizacaoConfiguracaoBody = {
    fantasia?: unknown;
    cnpj?: unknown;
    emailSuporteContato?: unknown;
    contato?: unknown;
    disponibilidade?: unknown;
    smtpHost?: unknown;
    smtpPort?: unknown;
    smtpUser?: unknown;
    smtpPass?: unknown;
    smtpFrom?: unknown;
};

const DISPONIBILIDADES_VALIDAS = [
    "disponivel",
    "bloqueado_manutencao",
    "bloqueado_pagamento",
];

/**
 * Converte a configuração do banco para resposta da API com campos SMTP descriptografados.
 * Use apenas no server para preencher o formulário de configurações.
 */
function mapearConfiguracaoBancoParaApi(configuracao: ConfiguracaoAplicacaoBanco): ConfiguracaoAplicacao {
    return {
        ...configuracao,
        smtp_host: descriptografarValor(configuracao.smtp_host),
        smtp_port: descriptografarValor(configuracao.smtp_port),
        smtp_user: descriptografarValor(configuracao.smtp_user),
        smtp_pass: descriptografarValor(configuracao.smtp_pass),
        smtp_from: descriptografarValor(configuracao.smtp_from),
    };
}

/**
 * Endpoint GET de configurações da aplicação.
 * Use para carregar o único registro de configuração disponível no sistema.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "configuracao",
            acao: "visualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const resultado = await consultarBancoDados<ConfiguracaoAplicacaoBanco>(
            `
                select
                    id,
                    fantasia,
                    cnpj,
                    email_suporte_contato,
                    contato,
                    disponibilidade,
                    smtp_host,
                    smtp_port,
                    smtp_user,
                    smtp_pass,
                    smtp_from,
                    criado_em,
                    atualizado_em
                from configuracao
                limit 1
            `
        );

        const configuracao = resultado.rows[0];

        return criarRespostaApi(
            true,
            "Configurações carregadas com sucesso.",
            configuracao ? mapearConfiguracaoBancoParaApi(configuracao) : null
        );
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar as configurações.", null, 500);
    }
}

/**
 * Endpoint PUT de configurações da aplicação.
 * Atualiza o único registro de configuração existente e salva credenciais SMTP criptografadas.
 */
export async function PUT(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "configuracao",
            acao: "atualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const body = await request.json() as AtualizacaoConfiguracaoBody;

        const fantasia = validarStringComConteudo(body.fantasia) ? body.fantasia.trim() : "";
        const cnpj = validarStringComConteudo(body.cnpj) ? body.cnpj.trim() : "";
        const emailSuporteContato = validarStringComConteudo(body.emailSuporteContato)
            ? body.emailSuporteContato.trim().toLowerCase()
            : "";
        const contato = validarStringComConteudo(body.contato) ? body.contato.trim() : "";
        const disponibilidade = validarStringComConteudo(body.disponibilidade) ? body.disponibilidade.trim() : "";
        const smtpHost = validarStringComConteudo(body.smtpHost) ? body.smtpHost.trim() : "";
        const smtpPort = validarStringComConteudo(body.smtpPort) ? body.smtpPort.trim() : "";
        const smtpUser = validarStringComConteudo(body.smtpUser) ? body.smtpUser.trim() : "";
        const smtpPass = validarStringComConteudo(body.smtpPass) ? body.smtpPass : "";
        const smtpFrom = validarStringComConteudo(body.smtpFrom) ? body.smtpFrom.trim() : "";
        const smtpPortNumber = Number(smtpPort);

        if (
            !fantasia
            || fantasia.length > 120
            || !cnpj
            || cnpj.length > 20
            || !validarEmail(emailSuporteContato)
            || emailSuporteContato.length > 180
            || !contato
            || contato.length > 120
            || !DISPONIBILIDADES_VALIDAS.includes(disponibilidade)
            || !smtpHost
            || smtpHost.length > 255
            || !Number.isInteger(smtpPortNumber)
            || smtpPortNumber <= 0
            || smtpPortNumber > 65535
            || !smtpUser
            || smtpUser.length > 255
            || !smtpPass
            || smtpPass.length > 255
            || !smtpFrom
            || smtpFrom.length > 255
        ) {
            return criarRespostaApi(false, "Informe os dados de configuração dentro do limite permitido.", null, 400);
        }

        const resultado = await consultarBancoDados<ConfiguracaoAplicacaoBanco>(
            `
                update configuracao
                set
                    fantasia = $1,
                    cnpj = $2,
                    email_suporte_contato = $3,
                    contato = $4,
                    disponibilidade = $5,
                    smtp_host = $6,
                    smtp_port = $7,
                    smtp_user = $8,
                    smtp_pass = $9,
                    smtp_from = $10,
                    atualizado_em = now()
                where id = (
                    select id
                    from configuracao
                    order by id
                    limit 1
                )
                returning
                    id,
                    fantasia,
                    cnpj,
                    email_suporte_contato,
                    contato,
                    disponibilidade,
                    smtp_host,
                    smtp_port,
                    smtp_user,
                    smtp_pass,
                    smtp_from,
                    criado_em,
                    atualizado_em
            `,
            [
                fantasia,
                cnpj,
                emailSuporteContato,
                contato,
                disponibilidade,
                criptografarValor(smtpHost),
                criptografarValor(smtpPort),
                criptografarValor(smtpUser),
                criptografarValor(smtpPass),
                criptografarValor(smtpFrom),
            ]
        );

        const configuracao = resultado.rows[0];

        if (!configuracao) {
            return criarRespostaApi(false, "Configuração não encontrada.", null, 404);
        }

        return criarRespostaApi(
            true,
            "Configurações atualizadas com sucesso.",
            mapearConfiguracaoBancoParaApi(configuracao)
        );
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe uma configuração com este CNPJ.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível atualizar as configurações.", null, 500);
    }
}
