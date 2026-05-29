import { NextRequest } from "next/server";
import { consultarBancoDados, obterClienteBancoDados } from "@/services/database";
import { enviarEmail } from "@/services/email";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { validarStringComConteudo } from "@/utils/validacoes";
import type { PoolClient } from "pg";

type CorpoCriacaoMensagemTicket = {
    ticketId?: unknown;
    empresaNavegacaoId?: unknown;
    conteudo?: unknown;
};

type TicketMensagemContexto = {
    empresa_id: number;
    titulo: string;
    responsavel_id: number;
    responsavel_email: string | null;
    agente_id: number | null;
    status: string;
    suporte_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

const STATUS_INICIAL_TICKET = "pendente_vinculo_agente";

const rotulosStatus: Record<string, string> = {
    pendente_vinculo_agente: "Pendente vínculo agente",
    com_agente: "Com agente",
    com_cliente: "Com cliente",
    encerrado_resolvido: "Encerrado resolvido",
    encerrado_nao_resolvido: "Encerrado não resolvido",
};

function normalizarId(valor: unknown): number | null {
    const id = Number(valor);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizarNomePerfil(nome: string | null): string {
    return (nome || "").trim().toLowerCase();
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

function escaparHtml(valor: string): string {
    return valor
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function usuarioPodeInteragirComTicket({
    contexto,
    idUsuario,
}: {
    contexto: TicketMensagemContexto;
    idUsuario: number;
}): boolean {
    const perfilNormalizado = normalizarNomePerfil(contexto.perfil_nome);
    const usuarioAgenteSuporte = perfilNormalizado === "agente de suporte";
    const usuarioClienteManager = perfilNormalizado === "cliente manager";

    if (usuarioAgenteSuporte) {
        return !contexto.suporte_visualiza_apenas_tickets_proprios
            || contexto.agente_id === idUsuario
            || contexto.status === STATUS_INICIAL_TICKET;
    }

    if (usuarioClienteManager) {
        return true;
    }

    return contexto.responsavel_id === idUsuario;
}

/**
 * Monta o HTML enviado ao responsável quando um agente adiciona mensagem ao ticket.
 */
function montarHtmlNovaMensagemTicket({
    titulo,
    status,
}: {
    titulo: string;
    status: string;
}): string {
    const tituloSeguro = escaparHtml(titulo);
    const statusSeguro = escaparHtml(rotulosStatus[status] || status);

    return `
        <div style="margin:0;padding:32px;background-color:#f4f7fb;font-family:Arial,sans-serif;color:#273142;">
            <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #dce3ec;border-radius:8px;overflow:hidden;">
                <div style="padding:24px;background-color:#111827;color:#e5edf8;">
                    <h1 style="margin:0;font-size:22px;line-height:1.3;">Nova mensagem no ticket</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">GSD Desk</p>
                </div>

                <div style="padding:28px 24px;">
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">
                        Um agente de suporte adicionou uma nova mensagem no seu ticket.
                    </p>

                    <div style="margin:0 0 22px;padding:18px;border:1px solid #dce3ec;border-radius:8px;background-color:#f8fafc;">
                        <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
                            <strong style="color:#172033;">Título:</strong> ${tituloSeguro}
                        </p>
                        <p style="margin:0;font-size:14px;line-height:1.5;">
                            <strong style="color:#172033;">Status atual:</strong> ${statusSeguro}
                        </p>
                    </div>

                    <p style="margin:0;color:#6c757d;font-size:13px;line-height:1.5;">
                        Acesse o GSD Desk para visualizar a mensagem e continuar o atendimento.
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Endpoint POST de mensagens de ticket.
 * Adiciona uma nova mensagem no chat e atualiza a data de última alteração do ticket.
 */
export async function POST(request: NextRequest) {
    let cliente: PoolClient | null = null;
    let transacaoAberta = false;
    let mensagemCriada = false;

    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "ticket",
            acao: "atualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const body = await request.json() as CorpoCriacaoMensagemTicket;
        const ticketId = normalizarId(body.ticketId);
        const empresaNavegacaoId = normalizarId(body.empresaNavegacaoId);
        const conteudo = validarStringComConteudo(body.conteudo) ? body.conteudo.trim() : "";
        const textoMensagem = obterTextoMensagem(conteudo);

        if (!ticketId || !empresaNavegacaoId) {
            return criarRespostaApi(false, "Informe ticket e empresa de navegação válidos.", null, 400);
        }

        if (!textoMensagem) {
            return criarRespostaApi(false, "Informe uma mensagem para enviar no chat.", null, 400);
        }

        if (conteudo.length > 20000) {
            return criarRespostaApi(false, "A mensagem deve ter no máximo 20.000 caracteres.", null, 400);
        }

        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaNavegacaoId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        const resultadoContexto = await consultarBancoDados<TicketMensagemContexto>(
            `
                select
                    t.empresa_id,
                    t.titulo,
                    t.responsavel_id,
                    responsavel.email as responsavel_email,
                    t.agente_id,
                    t.status,
                    e.suporte_visualiza_apenas_tickets_proprios,
                    p.nome as perfil_nome
                from tickets t
                inner join empresas e on e.id = t.empresa_id
                inner join usuarios responsavel on responsavel.id = t.responsavel_id
                inner join usuarios u on u.id = $3
                left join perfil p on p.id = u.perfil_id
                where t.id = $1
                    and t.empresa_id = $2
                limit 1
            `,
            [ticketId, empresaNavegacaoId, idUsuario]
        );
        const contexto = resultadoContexto.rows[0];

        if (!contexto) {
            return criarRespostaApi(false, "Ticket não encontrado para a empresa selecionada.", null, 404);
        }

        if (!usuarioPodeInteragirComTicket({ contexto, idUsuario })) {
            return criarRespostaApi(false, "Você não possui permissão para enviar mensagem neste ticket.", null, 403);
        }

        const usuarioAgenteSuporte = normalizarNomePerfil(contexto.perfil_nome) === "agente de suporte";

        cliente = await obterClienteBancoDados();
        await cliente.query("begin");
        transacaoAberta = true;

        await cliente.query(
            `
                insert into ticket_mensagens (
                    ticket_id,
                    conteudo,
                    enviado_por
                )
                values ($1, $2, $3)
            `,
            [ticketId, conteudo, idUsuario]
        );

        await cliente.query(
            `
                update tickets
                set
                    agente_id = case
                        when $3::boolean = true then $4
                        else agente_id
                    end,
                    ultima_atualizacao_em = now()
                where id = $1
                    and empresa_id = $2
            `,
            [ticketId, empresaNavegacaoId, usuarioAgenteSuporte, idUsuario]
        );

        await cliente.query("commit");
        transacaoAberta = false;
        mensagemCriada = true;

        if (usuarioAgenteSuporte && contexto.responsavel_email) {
            await enviarEmail({
                to: contexto.responsavel_email,
                subject: `Nova mensagem no ticket: ${contexto.titulo}`,
                html: montarHtmlNovaMensagemTicket({
                    titulo: contexto.titulo,
                    status: contexto.status,
                }),
            });
        }

        return criarRespostaApi(true, "Mensagem enviada com sucesso.", null, 201);
    } catch {
        if (transacaoAberta) {
            await cliente?.query("rollback").catch(() => undefined);
        }

        if (mensagemCriada) {
            return criarRespostaApi(false, "Mensagem enviada, mas não foi possível enviar o e-mail para o responsável.", null, 500);
        }

        return criarRespostaApi(false, "Não foi possível enviar a mensagem.", null, 500);
    } finally {
        cliente?.release();
    }
}
