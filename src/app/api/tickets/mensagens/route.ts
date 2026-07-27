import { NextRequest } from "next/server";
import { consultarBancoDados, obterClienteBancoDados } from "@/services/database";
import { enviarEmail } from "@/services/email";
import { registrarAuditoriaSegura } from "@/utils/auditoria";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { normalizarNomePerfil, STATUS_INICIAL_TICKET, usuarioPodeVisualizarTicket } from "@/utils/tickets";
import { validarStringComConteudo } from "@/utils/validacoes";
import type { PoolClient } from "pg";

type TicketMensagemContexto = {
    empresa_id: number;
    titulo: string;
    responsavel_id: number;
    responsavel_email: string | null;
    agente_id: number | null;
    agente_email: string | null;
    status: string;
    suporte_visualiza_apenas_tickets_proprios: boolean;
    cliente_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

type TicketMensagemAtualizado = {
    status: string;
};

type ResultadoMensagemId = {
    id: number;
};

const STATUS_COM_AGENTE = "com_agente";
const STATUS_COM_CLIENTE = "com_cliente";
const STATUS_TICKET_ENCERRADO = new Set(["encerrado_resolvido", "encerrado_nao_resolvido"]);
const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;
const TIPOS_ANEXO_PERMITIDOS = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

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

function obterExtensaoArquivo(nomeOriginal: string): string | null {
    const partesNome = nomeOriginal.split(".");
    const extensao = partesNome.length > 1 ? partesNome.pop()?.trim().toLowerCase() : "";

    return extensao ? extensao.slice(0, 20) : null;
}

function validarAnexos(anexos: File[]): string | null {
    for (const anexo of anexos) {
        if (anexo.size > TAMANHO_MAXIMO_ANEXO) {
            return `O arquivo ${anexo.name} excede o limite de 10 MB.`;
        }

        if (!TIPOS_ANEXO_PERMITIDOS.has(anexo.type)) {
            return `O tipo do arquivo ${anexo.name} não é permitido.`;
        }
    }

    return null;
}

async function inserirAnexosMensagem({
    cliente,
    ticketId,
    mensagemId,
    anexos,
    idUsuario,
}: {
    cliente: PoolClient;
    ticketId: number;
    mensagemId: number;
    anexos: File[];
    idUsuario: number;
}) {
    for (const anexo of anexos) {
        const arrayBuffer = await anexo.arrayBuffer();

        await cliente.query(
            `
                insert into ticket_mensagens_anexos (
                    ticket_id,
                    mensagem_id,
                    nome_original,
                    mime_type,
                    extensao,
                    tamanho_bytes,
                    arquivo,
                    criado_por
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                ticketId,
                mensagemId,
                anexo.name.slice(0, 255),
                anexo.type,
                obterExtensaoArquivo(anexo.name),
                anexo.size,
                Buffer.from(arrayBuffer),
                idUsuario,
            ]
        );
    }
}

function montarHtmlNovaMensagemTicket({
    titulo,
    status,
    textoIntroducao,
}: {
    titulo: string;
    status: string;
    textoIntroducao: string;
}): string {
    const tituloSeguro = escaparHtml(titulo);
    const statusSeguro = escaparHtml(rotulosStatus[status] || status);
    const textoIntroducaoSeguro = escaparHtml(textoIntroducao);

    return `
        <div style="margin:0;padding:32px;background-color:#f4f7fb;font-family:Arial,sans-serif;color:#273142;">
            <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #dce3ec;border-radius:8px;overflow:hidden;">
                <div style="padding:24px;background-color:#111827;color:#e5edf8;">
                    <h1 style="margin:0;font-size:22px;line-height:1.3;">Nova mensagem no ticket</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">GSD Desk</p>
                </div>

                <div style="padding:28px 24px;">
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">
                        ${textoIntroducaoSeguro}
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
 * Adiciona uma nova mensagem e seus anexos opcionais na mesma transação.
 */
export async function POST(request: NextRequest) {
    let cliente: PoolClient | null = null;
    let transacaoAberta = false;

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

        const formData = await request.formData();
        const ticketId = normalizarId(formData.get("ticketId"));
        const empresaNavegacaoId = normalizarId(formData.get("empresaNavegacaoId"));
        const conteudo = validarStringComConteudo(formData.get("conteudo")) ? String(formData.get("conteudo")).trim() : "";
        const atualizarStatusTicket = formData.get("atualizarStatusTicket") === "true";
        const textoMensagem = obterTextoMensagem(conteudo);
        const anexos = formData.getAll("anexos").filter((valor): valor is File => valor instanceof File);

        if (!ticketId || !empresaNavegacaoId) {
            return criarRespostaApi(false, "Informe ticket e empresa de navegação válidos.", null, 400);
        }

        if (!textoMensagem) {
            return criarRespostaApi(false, "Informe uma mensagem para enviar no chat.", null, 400);
        }

        if (conteudo.length > 20000) {
            return criarRespostaApi(false, "A mensagem deve ter no máximo 20.000 caracteres.", null, 400);
        }

        const erroAnexos = validarAnexos(anexos);

        if (erroAnexos) {
            return criarRespostaApi(false, erroAnexos, null, 400);
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
                    agente.email as agente_email,
                    t.status,
                    e.suporte_visualiza_apenas_tickets_proprios,
                    e.cliente_visualiza_apenas_tickets_proprios,
                    p.nome as perfil_nome
                from tickets t
                inner join empresas e on e.id = t.empresa_id
                inner join usuarios responsavel on responsavel.id = t.responsavel_id
                left join usuarios agente on agente.id = t.agente_id
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

        if (!usuarioPodeVisualizarTicket({ ticket: contexto, idUsuario, contexto })) {
            return criarRespostaApi(false, "Você não possui permissão para enviar mensagem neste ticket.", null, 403);
        }

        const usuarioAgenteSuporte = normalizarNomePerfil(contexto.perfil_nome) === "agente de suporte";
        const usuarioResponsavelTicket = parseInt(contexto.responsavel_id.toString()) === idUsuario;
        const usuarioAgenteTicket = contexto.agente_id !== null && parseInt(contexto.agente_id.toString()) === idUsuario;
        const usuarioParticipanteFluxoTicket = usuarioResponsavelTicket || usuarioAgenteTicket;
        const reaberturaObrigatoria = STATUS_TICKET_ENCERRADO.has(contexto.status);
        const deveAtualizarFluxoMensagem = usuarioParticipanteFluxoTicket && (atualizarStatusTicket || reaberturaObrigatoria);
        cliente = await obterClienteBancoDados();
        await cliente.query("begin");
        transacaoAberta = true;

        const resultadoMensagem = await cliente.query<ResultadoMensagemId>(
            `
                insert into ticket_mensagens (
                    ticket_id,
                    conteudo,
                    enviado_por
                )
                values ($1, $2, $3)
                returning id
            `,
            [ticketId, conteudo, idUsuario]
        );
        const mensagemId = resultadoMensagem.rows[0]?.id;

        if (!mensagemId) {
            throw new Error("Mensagem não retornada após o cadastro.");
        }

        await inserirAnexosMensagem({
            cliente,
            ticketId,
            mensagemId,
            anexos,
            idUsuario,
        });

        const resultadoTicketAtualizado = await cliente.query<TicketMensagemAtualizado>(
            `
                update tickets
                set
                    agente_id = case
                        when $3::boolean = true and agente_id is null then $4
                        else agente_id
                    end,
                    status = case
                        when $5::boolean = true and $10::boolean = true then $8
                        when $6::boolean = true and $10::boolean = true then $9
                        when $3::boolean = true and status = $7 then $8
                        else status
                    end,
                    ultima_atualizacao_em = now(),
                    fechado_em = case
                        when $10::boolean = true then null
                        else fechado_em
                    end,
                    fechado_por = case
                        when $10::boolean = true then null
                        else fechado_por
                    end
                where id = $1
                    and empresa_id = $2
                returning status
            `,
            [
                ticketId,
                empresaNavegacaoId,
                usuarioAgenteSuporte,
                idUsuario,
                usuarioResponsavelTicket,
                usuarioAgenteTicket,
                STATUS_INICIAL_TICKET,
                STATUS_COM_AGENTE,
                STATUS_COM_CLIENTE,
                deveAtualizarFluxoMensagem,
            ]
        );
        const statusAtualizadoTicket = resultadoTicketAtualizado.rows[0]?.status ?? contexto.status;

        await cliente.query("commit");
        transacaoAberta = false;

        try {
            if (usuarioAgenteSuporte && contexto.responsavel_email) {
                await enviarEmail({
                    to: contexto.responsavel_email,
                    subject: `Nova mensagem no ticket: ${contexto.titulo}`,
                    html: montarHtmlNovaMensagemTicket({
                        titulo: contexto.titulo,
                        status: statusAtualizadoTicket,
                        textoIntroducao: "Um agente de suporte adicionou uma nova mensagem no seu ticket.",
                    }),
                });
            }

            if (usuarioResponsavelTicket && contexto.agente_id && contexto.agente_email) {
                await enviarEmail({
                    to: contexto.agente_email,
                    subject: `Nova mensagem no ticket: ${contexto.titulo}`,
                    html: montarHtmlNovaMensagemTicket({
                        titulo: contexto.titulo,
                        status: statusAtualizadoTicket,
                        textoIntroducao: "O responsável pelo ticket adicionou uma nova mensagem.",
                    }),
                });
            }
        } catch (erroEmail) {
            console.error("Não foi possível enviar notificação de nova mensagem do ticket.", erroEmail);
        }

        try {
            await registrarAuditoriaSegura({
                acao: "CREATE",
                usuarioId: idUsuario,
                empresaId: empresaNavegacaoId,
                metodo: request.method,
                rota: request.nextUrl.pathname,
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

        return criarRespostaApi(true, "Mensagem enviada com sucesso.", null, 201);
    } catch {
        if (transacaoAberta) {
            await cliente?.query("rollback").catch(() => undefined);
        }

        return criarRespostaApi(false, "Não foi possível enviar a mensagem.", null, 500);
    } finally {
        cliente?.release();
    }
}
