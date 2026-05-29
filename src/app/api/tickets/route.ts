import { NextRequest } from "next/server";
import { obterClienteBancoDados } from "@/services/database";
import { enviarEmail } from "@/services/email";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { validarStringComConteudo } from "@/utils/validacoes";
import type { PoolClient } from "pg";

type CorpoCadastroTicket = {
    titulo?: unknown;
    empresaId?: unknown;
    produtoId?: unknown;
    responsavelId?: unknown;
    prioridade?: unknown;
    mensagemInicial?: unknown;
};

type ResultadoId = {
    id: number;
};

type DadosNotificacaoTicket = {
    empresa_nome: string;
    produto_nome: string;
    responsavel_nome: string;
};

type AgenteNotificacaoTicket = {
    email: string;
};

const STATUS_INICIAL_TICKET = "pendente_vinculo_agente";
const prioridadesPermitidas = ["baixa", "media", "alta", "muito_alta"];

function normalizarId(valor: unknown): number | null {
    const id = Number(valor);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function obterTextoMensagem(conteudoHtml: string): string {
    return conteudoHtml
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function erroComCodigo(erro: unknown): erro is { code: string } {
    return typeof erro === "object"
        && erro !== null
        && "code" in erro
        && typeof erro.code === "string";
}

function escaparHtml(valor: string): string {
    return valor
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Monta o HTML de notificação enviado aos agentes quando um ticket é aberto.
 */
function montarHtmlNovoTicket({
    titulo,
    empresa,
    produto,
    responsavel,
}: {
    titulo: string;
    empresa: string;
    produto: string;
    responsavel: string;
}): string {
    const tituloSeguro = escaparHtml(titulo);
    const empresaSegura = escaparHtml(empresa);
    const produtoSeguro = escaparHtml(produto);
    const responsavelSeguro = escaparHtml(responsavel);

    return `
        <div style="margin:0;padding:32px;background-color:#f4f7fb;font-family:Arial,sans-serif;color:#273142;">
            <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #dce3ec;border-radius:8px;overflow:hidden;">
                <div style="padding:24px;background-color:#111827;color:#e5edf8;">
                    <h1 style="margin:0;font-size:22px;line-height:1.3;">Novo ticket aberto</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">GSD Desk</p>
                </div>

                <div style="padding:28px 24px;">
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">
                        Um novo ticket foi aberto e está pendente de vínculo com um agente.
                    </p>

                    <div style="margin:0 0 22px;padding:18px;border:1px solid #dce3ec;border-radius:8px;background-color:#f8fafc;">
                        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
                            <strong style="color:#172033;">Título:</strong> ${tituloSeguro}
                        </p>
                        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
                            <strong style="color:#172033;">Empresa:</strong> ${empresaSegura}
                        </p>
                        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
                            <strong style="color:#172033;">Produto:</strong> ${produtoSeguro}
                        </p>
                        <p style="margin:0;font-size:14px;line-height:1.5;">
                            <strong style="color:#172033;">Responsável:</strong> ${responsavelSeguro}
                        </p>
                    </div>

                    <p style="margin:0;color:#6c757d;font-size:13px;line-height:1.5;">
                        Acesse o GSD Desk para assumir o atendimento ou acompanhar a fila de tickets.
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Endpoint POST de tickets.
 * Cria o ticket e sua primeira mensagem na mesma transação.
 */
export async function POST(request: NextRequest) {
    let cliente: PoolClient | null = null;
    let transacaoAberta = false;
    let ticketCriado = false;

    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "ticket",
            acao: "criar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const body = await request.json() as CorpoCadastroTicket;
        const titulo = validarStringComConteudo(body.titulo) ? body.titulo.trim() : "";
        const empresaId = normalizarId(body.empresaId);
        const produtoId = normalizarId(body.produtoId);
        const responsavelId = normalizarId(body.responsavelId);
        const prioridade = validarStringComConteudo(body.prioridade) ? body.prioridade.trim() : "";
        const mensagemInicial = validarStringComConteudo(body.mensagemInicial) ? body.mensagemInicial.trim() : "";
        const textoMensagemInicial = obterTextoMensagem(mensagemInicial);

        if (titulo.length < 5 || titulo.length > 50) {
            return criarRespostaApi(false, "O título deve ter entre 5 e 50 caracteres.", null, 400);
        }

        if (!empresaId || !produtoId || !responsavelId) {
            return criarRespostaApi(false, "Informe empresa, produto e responsável para criar o ticket.", null, 400);
        }

        if (!prioridadesPermitidas.includes(prioridade)) {
            return criarRespostaApi(false, "Informe uma prioridade válida para criar o ticket.", null, 400);
        }

        if (!textoMensagemInicial) {
            return criarRespostaApi(false, "Informe a mensagem inicial para abrir o ticket.", null, 400);
        }

        if (mensagemInicial.length > 20000) {
            return criarRespostaApi(false, "A mensagem inicial deve ter no máximo 20.000 caracteres.", null, 400);
        }

        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        cliente = await obterClienteBancoDados();

        const resultadoContexto = await cliente.query<{
            empresa_ativa: boolean;
            exigir_vinculo_produto: boolean;
            produto_ativo: boolean;
            produto_vinculado_usuario: boolean;
            responsavel_valido: boolean;
        }>(
            `
                select
                    exists (
                        select 1
                        from empresas e
                        where e.id = $1
                            and e.ativo = true
                    ) as empresa_ativa,
                    coalesce((
                        select e.exigir_vinculo_produto
                        from empresas e
                        where e.id = $1
                    ), false) as exigir_vinculo_produto,
                    exists (
                        select 1
                        from produtos p
                        where p.id = $2
                            and p.empresa_id = $1
                            and p.ativo = true
                    ) as produto_ativo,
                    exists (
                        select 1
                        from usuarios_produtos up
                        where up.empresa_id = $1
                            and up.produto_id = $2
                            and up.usuario_id = $3
                    ) as produto_vinculado_usuario,
                    exists (
                        select 1
                        from usuarios_empresas ue
                        inner join usuarios u on u.id = ue.usuario_id
                        left join perfil p on p.id = u.perfil_id
                        where ue.empresa_id = $1
                            and u.id = $4
                            and u.ativo = true
                            and lower(coalesce(p.nome, '')) <> 'agente de suporte'
                    ) as responsavel_valido
            `,
            [empresaId, produtoId, idUsuario, responsavelId]
        );
        const contexto = resultadoContexto.rows[0];

        if (!contexto?.empresa_ativa) {
            return criarRespostaApi(false, "Empresa não encontrada ou inativa.", null, 404);
        }

        if (!contexto.produto_ativo) {
            return criarRespostaApi(false, "Produto não encontrado ou inativo para a empresa informada.", null, 400);
        }

        if (contexto.exigir_vinculo_produto && !contexto.produto_vinculado_usuario) {
            return criarRespostaApi(false, "Usuário autenticado não possui vínculo com o produto informado.", null, 403);
        }

        if (!contexto.responsavel_valido) {
            return criarRespostaApi(false, "O responsável deve ser um usuário ativo da empresa e não pode ser Agente de Suporte.", null, 400);
        }

        const resultadoDadosNotificacao = await cliente.query<DadosNotificacaoTicket>(
            `
                select
                    e.fantasia as empresa_nome,
                    p.nome as produto_nome,
                    u.nome as responsavel_nome
                from empresas e
                inner join produtos p on p.empresa_id = e.id
                    and p.id = $2
                inner join usuarios u on u.id = $3
                where e.id = $1
                limit 1
            `,
            [empresaId, produtoId, responsavelId]
        );
        const dadosNotificacao = resultadoDadosNotificacao.rows[0];

        const resultadoAgentesNotificacao = await cliente.query<AgenteNotificacaoTicket>(
            `
                select distinct
                    u.email
                from usuarios_empresas ue
                inner join usuarios u on u.id = ue.usuario_id
                inner join perfil p on p.id = u.perfil_id
                where ue.empresa_id = $1
                    and u.ativo = true
                    and lower(coalesce(p.nome, '')) = 'agente de suporte'
                    and u.email is not null
                    and trim(u.email) <> ''
                order by u.email asc
            `,
            [empresaId]
        );
        const emailsAgentes = resultadoAgentesNotificacao.rows.map((agente) => agente.email);

        await cliente.query("begin");
        transacaoAberta = true;

        const resultadoTicket = await cliente.query<ResultadoId>(
            `
                insert into tickets (
                    titulo,
                    empresa_id,
                    produto_id,
                    responsavel_id,
                    agente_id,
                    status,
                    prioridade,
                    criado_por
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8)
                returning id
            `,
            [titulo, empresaId, produtoId, responsavelId, null, STATUS_INICIAL_TICKET, prioridade, idUsuario]
        );
        const ticketId = resultadoTicket.rows[0]?.id;

        if (!ticketId) {
            throw new Error("Ticket não retornado após o cadastro.");
        }

        await cliente.query(
            `
                insert into ticket_mensagens (
                    ticket_id,
                    conteudo,
                    enviado_por
                )
                values ($1, $2, $3)
            `,
            [ticketId, mensagemInicial, idUsuario]
        );

        await cliente.query("commit");
        transacaoAberta = false;
        ticketCriado = true;

        if (dadosNotificacao && emailsAgentes.length > 0) {
            await enviarEmail({
                to: emailsAgentes.join(","),
                subject: `Novo ticket aberto: ${titulo}`,
                html: montarHtmlNovoTicket({
                    titulo: titulo,
                    empresa: dadosNotificacao.empresa_nome,
                    produto: dadosNotificacao.produto_nome,
                    responsavel: dadosNotificacao.responsavel_nome,
                }),
            });
        }

        return criarRespostaApi(true, "Ticket criado com sucesso.", { id: ticketId }, 201);
    } catch (erro) {
        if (transacaoAberta) {
            await cliente?.query("rollback").catch(() => undefined);
        }

        if (ticketCriado) {
            return criarRespostaApi(false, "Ticket criado, mas não foi possível enviar o e-mail para os agentes de suporte.", null, 500);
        }

        if (erroComCodigo(erro) && erro.code === "23503") {
            return criarRespostaApi(false, "Empresa, produto ou usuário informado não foi encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível criar o ticket.", null, 500);
    } finally {
        cliente?.release();
    }
}
