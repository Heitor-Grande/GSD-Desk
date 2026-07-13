import { NextRequest } from "next/server";
import { consultarBancoDados, obterClienteBancoDados } from "@/services/database";
import { enviarEmail } from "@/services/email";
import { registrarAuditoriaSegura } from "@/utils/auditoria";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { STATUS_INICIAL_TICKET, usuarioPodeVisualizarTicket } from "@/utils/tickets";
import { validarStringComConteudo } from "@/utils/validacoes";
import type { PoolClient } from "pg";

type CorpoAtualizacaoTicket = {
    id?: unknown;
    empresaNavegacaoId?: unknown;
    titulo?: unknown;
    responsavelId?: unknown;
    agenteId?: unknown;
    status?: unknown;
    prioridade?: unknown;
};

type ResultadoId = {
    id: number;
};

type ResultadoMensagemId = {
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

type TicketListado = {
    id: number;
    titulo: string;
    responsavel_id: number;
    agente_id: number | null;
    empresa_nome: string;
    produto_nome: string;
    responsavel_nome: string;
    agente_nome: string | null;
    status: string;
    prioridade: string;
    criado_em: Date;
    ultima_atualizacao_em: Date;
};

type TicketDetalhado = TicketListado & {
    empresa_id: number;
    produto_id: number;
    criado_por: number;
    criado_por_nome: string;
    fechado_em: Date | null;
    fechado_por: number | null;
    fechado_por_nome: string | null;
    usuario_logado_id?: number;
    usuario_pode_editar_informacoes_gerais?: boolean;
    usuario_pode_editar_responsavel?: boolean;
    usuario_pode_editar_status?: boolean;
    usuario_pode_editar_agente?: boolean;
    usuario_pode_editar_prioridade?: boolean;
};

type TicketAuditoria = {
    id: number;
    titulo: string;
    empresa_id: number;
    produto_id: number;
    responsavel_id: number;
    agente_id: number | null;
    status: string;
    prioridade: string;
    criado_em: Date;
    criado_por: number;
    ultima_atualizacao_em: Date;
    fechado_em: Date | null;
    fechado_por: number | null;
};

type MensagemTicketDetalhe = {
    id: number;
    conteudo: string;
    enviado_por: number;
    enviado_por_nome: string;
    enviado_em: Date;
    anexos?: AnexoMensagemTicketDetalhe[];
};

type AnexoMensagemTicketDetalhe = {
    id: number;
    mensagem_id: number;
    nome_original: string;
};

type ContextoListagemTicket = {
    suporte_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

const statusPermitidos = [
    STATUS_INICIAL_TICKET,
    "com_agente",
    "com_cliente",
    "encerrado_resolvido",
    "encerrado_nao_resolvido",
];
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

function normalizarId(valor: unknown): number | null {
    const id = Number(valor);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
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
 * Endpoint GET de tickets.
 * Lista tickets da empresa de navegação respeitando vínculo, permissão e regras.
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Valida se o usuário possui permissão para visualizar tickets.
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "ticket",
            acao: "visualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        // 2. Identifica o usuário logado para aplicar vínculo e escopo da listagem.
        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        // 3. Valida a empresa de navegação enviada pela tela.
        const empresaNavegacaoId = Number(request.nextUrl.searchParams.get("empresaNavegacaoId"));

        if (!validarIdPositivo(empresaNavegacaoId)) {
            return criarRespostaApi(false, "Informe uma empresa de navegação válida para listar tickets.", null, 400);
        }

        // 4. Confirma se a empresa pertence ao usuário autenticado.
        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaNavegacaoId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        // 5. Busca somente os dados necessários para decidir o escopo em TypeScript.
        const resultadoContexto = await consultarBancoDados<ContextoListagemTicket>(
            `
                select
                    e.suporte_visualiza_apenas_tickets_proprios,
                    p.nome as perfil_nome
                from empresas e
                inner join usuarios u on u.id = $2
                left join perfil p on p.id = u.perfil_id
                where e.id = $1
                    and e.ativo = true
                limit 1
            `,
            [empresaNavegacaoId, idUsuario]
        );
        const contexto = resultadoContexto.rows[0];
        
        if (!contexto) {
            return criarRespostaApi(false, "Empresa não encontrada ou inativa.", null, 404);
        }

        const ticketIdDetalhe = Number(request.nextUrl.searchParams.get("id"));

        if (request.nextUrl.searchParams.has("id")) {
            if (!validarIdPositivo(ticketIdDetalhe)) {
                return criarRespostaApi(false, "Informe um ticket válido para consulta.", null, 400);
            }

            // 6. Quando houver id, carrega o ticket completo para abertura do modal.
            const resultadoTicket = await consultarBancoDados<TicketDetalhado>(
                `
                    select
                        t.id,
                        t.titulo,
                        t.empresa_id,
                        t.produto_id,
                        t.responsavel_id,
                        t.agente_id,
                        e.fantasia as empresa_nome,
                        p.nome as produto_nome,
                        responsavel.nome as responsavel_nome,
                        agente.nome as agente_nome,
                        t.status,
                        t.prioridade,
                        t.criado_em,
                        t.criado_por,
                        criado_por.nome as criado_por_nome,
                        t.ultima_atualizacao_em,
                        t.fechado_em,
                        t.fechado_por,
                        fechado_por.nome as fechado_por_nome,
                        $3::bigint as usuario_logado_id,
                        t.responsavel_id <> $3 as usuario_pode_editar_informacoes_gerais,
                        (
                            t.responsavel_id <> $3
                            and lower(coalesce(perfil_usuario_logado.nome, '')) <> 'agente de suporte'
                        ) as usuario_pode_editar_responsavel,
                        (
                            t.responsavel_id <> $3
                            or lower(coalesce(perfil_usuario_logado.nome, '')) = 'cliente'
                        ) as usuario_pode_editar_status,
                        lower(coalesce(perfil_usuario_logado.nome, '')) = 'agente de suporte' as usuario_pode_editar_agente,
                        t.agente_id = $3 as usuario_pode_editar_prioridade
                    from tickets t
                    inner join empresas e on e.id = t.empresa_id
                    inner join produtos p on p.id = t.produto_id
                    inner join usuarios responsavel on responsavel.id = t.responsavel_id
                    inner join usuarios criado_por on criado_por.id = t.criado_por
                    left join usuarios agente on agente.id = t.agente_id
                    left join usuarios fechado_por on fechado_por.id = t.fechado_por
                    left join usuarios usuario_logado on usuario_logado.id = $3
                    left join perfil perfil_usuario_logado on perfil_usuario_logado.id = usuario_logado.perfil_id
                    where t.id = $1
                        and t.empresa_id = $2
                    limit 1
                `,
                [ticketIdDetalhe, empresaNavegacaoId, idUsuario]
            );
            const ticket = resultadoTicket.rows[0];

            if (!ticket) {
                return criarRespostaApi(false, "Ticket não encontrado para a empresa selecionada.", null, 404);
            }

            // 7. Aplica em TS a mesma regra de visibilidade usada na listagem.
            if (!usuarioPodeVisualizarTicket({ ticket, idUsuario, contexto })) {
                return criarRespostaApi(false, "Você não possui permissão para visualizar este ticket.", null, 403);
            }

            const resultadoMensagens = await consultarBancoDados<MensagemTicketDetalhe>(
                `
                    select
                        tm.id,
                        tm.conteudo,
                        tm.enviado_por,
                        u.nome as enviado_por_nome,
                        tm.enviado_em
                    from ticket_mensagens tm
                    inner join usuarios u on u.id = tm.enviado_por
                    where tm.ticket_id = $1
                    order by tm.enviado_em desc, tm.id desc
                `,
                [ticketIdDetalhe]
            );
            const resultadoAnexos = await consultarBancoDados<AnexoMensagemTicketDetalhe>(
                `
                    select
                        id,
                        mensagem_id,
                        nome_original
                    from ticket_mensagens_anexos
                    where ticket_id = $1
                    order by criado_em asc, id asc
                `,
                [ticketIdDetalhe]
            );
            const anexosPorMensagem = resultadoAnexos.rows.reduce<Record<number, AnexoMensagemTicketDetalhe[]>>((acumulador, anexo) => {
                acumulador[anexo.mensagem_id] = acumulador[anexo.mensagem_id] ?? [];
                acumulador[anexo.mensagem_id].push(anexo);

                return acumulador;
            }, {});
            const mensagensComAnexos = resultadoMensagens.rows.map((mensagem) => ({
                ...mensagem,
                anexos: anexosPorMensagem[mensagem.id] ?? [],
            }));

            return criarRespostaApi(
                true,
                "Ticket carregado com sucesso.",
                {
                    ticket: ticket,
                    mensagens: mensagensComAnexos,
                }
            );
        }

        // 6. Carrega todos os tickets da empresa; as regras de visibilidade são aplicadas abaixo em TS.
        const resultadoTickets = await consultarBancoDados<TicketListado>(
            `
                select
                    t.id,
                    t.titulo,
                    t.responsavel_id,
                    t.agente_id,
                    e.fantasia as empresa_nome,
                    p.nome as produto_nome,
                    responsavel.nome as responsavel_nome,
                    agente.nome as agente_nome,
                    t.status,
                    t.prioridade,
                    t.criado_em,
                    t.ultima_atualizacao_em
                from tickets t
                inner join empresas e on e.id = t.empresa_id
                inner join produtos p on p.id = t.produto_id
                inner join usuarios responsavel on responsavel.id = t.responsavel_id
                left join usuarios agente on agente.id = t.agente_id
                where t.empresa_id = $1
                order by t.criado_em desc, t.id desc
            `,
            [empresaNavegacaoId]
        );

        // 7. Filtra a lista em TS conforme perfil e regra da empresa.
        const ticketsVisiveis = resultadoTickets.rows.filter((ticket) => (
            usuarioPodeVisualizarTicket({ ticket, idUsuario, contexto })
        ));

        return criarRespostaApi(
            true,
            "Tickets listados com sucesso.",
            ticketsVisiveis
        );
    } catch {
        return criarRespostaApi(false, "Não foi possível listar os tickets.", null, 500);
    }
}

/**
 * Endpoint PUT de tickets.
 * Atualiza campos editáveis do ticket mantendo empresa e produto travados após a criação.
 */
export async function PUT(request: NextRequest) {
    try {
        // 1. Valida permissão de atualização de ticket.
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "ticket",
            acao: "atualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        // 2. Identifica o usuário e valida o corpo recebido.
        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const body = await request.json() as CorpoAtualizacaoTicket;
        const id = normalizarId(body.id);
        const empresaNavegacaoId = normalizarId(body.empresaNavegacaoId);
        const titulo = validarStringComConteudo(body.titulo) ? body.titulo.trim() : "";
        const responsavelId = normalizarId(body.responsavelId);
        const agenteId = normalizarId(body.agenteId);
        const status = validarStringComConteudo(body.status) ? body.status.trim() : "";
        const prioridade = validarStringComConteudo(body.prioridade) ? body.prioridade.trim() : "";

        if (!id || !empresaNavegacaoId) {
            return criarRespostaApi(false, "Informe ticket e empresa de navegação válidos.", null, 400);
        }

        if (titulo.length < 5 || titulo.length > 50) {
            return criarRespostaApi(false, "O título deve ter entre 5 e 50 caracteres.", null, 400);
        }

        if (!responsavelId) {
            return criarRespostaApi(false, "Informe um responsável válido para o ticket.", null, 400);
        }

        if (!statusPermitidos.includes(status)) {
            return criarRespostaApi(false, "Informe status válido para atualizar o ticket.", null, 400);
        }

        // 3. Confirma vínculo do usuário com a empresa de navegação.
        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaNavegacaoId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        // 4. Valida se o ticket pertence à empresa e se responsáveis/agentes são coerentes com seus perfis.
        const resultadoValidacao = await consultarBancoDados<{
            ticket_existe: boolean;
            titulo_atual: string | null;
            responsavel_atual_id: number | null;
            usuario_pode_editar_responsavel: boolean;
            status_atual: string | null;
            usuario_pode_editar_status: boolean;
            agente_atual_id: number | null;
            usuario_pode_editar_agente: boolean;
            prioridade_atual: string | null;
            usuario_pode_editar_prioridade: boolean;
            responsavel_valido: boolean;
            agente_valido: boolean;
        }>(
            `
                select
                    exists (
                        select 1
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                    ) as ticket_existe,
                    (
                        select t.titulo
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                        limit 1
                    ) as titulo_atual,
                    (
                        select t.responsavel_id
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                        limit 1
                    ) as responsavel_atual_id,
                    (
                        exists (
                            select 1
                            from usuarios u
                            left join perfil p on p.id = u.perfil_id
                            where u.id = $5
                                and u.ativo = true
                                and lower(coalesce(p.nome, '')) <> 'agente de suporte'
                        )
                    ) as usuario_pode_editar_responsavel,
                    (
                        select t.status
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                        limit 1
                    ) as status_atual,
                    (
                        exists (
                            select 1
                            from tickets t
                            where t.id = $1
                                and t.empresa_id = $2
                                and t.responsavel_id <> $5
                        )
                        or exists (
                            select 1
                            from usuarios u
                            left join perfil p on p.id = u.perfil_id
                            where u.id = $5
                                and u.ativo = true
                                and lower(coalesce(p.nome, '')) = 'cliente'
                        )
                    ) as usuario_pode_editar_status,
                    (
                        select t.agente_id
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                        limit 1
                    ) as agente_atual_id,
                    exists (
                        select 1
                        from usuarios u
                        left join perfil p on p.id = u.perfil_id
                        where u.id = $5
                            and u.ativo = true
                            and lower(coalesce(p.nome, '')) = 'agente de suporte'
                    ) as usuario_pode_editar_agente,
                    (
                        select t.prioridade
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                        limit 1
                    ) as prioridade_atual,
                    exists (
                        select 1
                        from tickets t
                        where t.id = $1
                            and t.empresa_id = $2
                            and t.agente_id = $5
                    ) as usuario_pode_editar_prioridade,
                    exists (
                        select 1
                        from usuarios_empresas ue
                        inner join usuarios u on u.id = ue.usuario_id
                        left join perfil p on p.id = u.perfil_id
                        where ue.empresa_id = $2
                            and u.id = $3
                            and u.ativo = true
                            and lower(coalesce(p.nome, '')) <> 'agente de suporte'
                    ) as responsavel_valido,
                    case
                        when $4::bigint is null then true
                        else exists (
                            select 1
                            from usuarios_empresas ue
                            inner join usuarios u on u.id = ue.usuario_id
                            left join perfil p on p.id = u.perfil_id
                            where ue.empresa_id = $2
                                and u.id = $4
                                and u.ativo = true
                                and lower(coalesce(p.nome, '')) = 'agente de suporte'
                        )
                    end as agente_valido
            `,
            [id, empresaNavegacaoId, responsavelId, agenteId, idUsuario]
        );
        const validacao = resultadoValidacao.rows[0];

        if (!validacao?.ticket_existe) {
            return criarRespostaApi(false, "Ticket não encontrado para a empresa selecionada.", null, 404);
        }

        const responsavelAlterado = responsavelId !== validacao.responsavel_atual_id;
        const agenteAlterado = agenteId !== validacao.agente_atual_id;
        const statusAlterado = status !== (validacao.status_atual ?? "");
        const prioridadeAlterada = prioridade !== (validacao.prioridade_atual ?? "");

        if (responsavelAlterado && !validacao.usuario_pode_editar_responsavel) {
            return criarRespostaApi(false, "Agente de Suporte não pode alterar o responsável do ticket.", null, 403);
        }

        if (statusAlterado && !validacao.usuario_pode_editar_status) {
            return criarRespostaApi(false, "Você não possui permissão para alterar o status do ticket.", null, 403);
        }

        if (statusAlterado && STATUS_TICKET_ENCERRADO.has(validacao.status_atual ?? "")) {
            return criarRespostaApi(false, "Tickets encerrados só podem ser reabertos pelo envio de uma nova mensagem.", null, 403);
        }

        if (!validacao.responsavel_valido) {
            return criarRespostaApi(false, "O responsável deve ser um usuário ativo da empresa e não pode ser Agente de Suporte.", null, 400);
        }

        if (!validacao.agente_valido) {
            return criarRespostaApi(false, "O agente deve ser um Agente de Suporte ativo vinculado à empresa.", null, 400);
        }

        if (!validacao.usuario_pode_editar_prioridade && prioridadeAlterada) {
            return criarRespostaApi(false, "Apenas o agente responsável pelo ticket pode alterar a prioridade.", null, 403);
        }

        const ticketEncerrado = status === "encerrado_resolvido" || status === "encerrado_nao_resolvido";

        const resultadoTicketAntes = await consultarBancoDados<TicketAuditoria>(
            `
                select
                    id,
                    titulo,
                    empresa_id,
                    produto_id,
                    responsavel_id,
                    agente_id,
                    status,
                    prioridade,
                    criado_em,
                    criado_por,
                    ultima_atualizacao_em,
                    fechado_em,
                    fechado_por
                from tickets
                where id = $1
                    and empresa_id = $2
                limit 1
            `,
            [id, empresaNavegacaoId]
        );

        // 5. Atualiza somente campos editáveis; empresa e produto permanecem fixos.
        const resultadoTicketDepois = await consultarBancoDados<TicketAuditoria>(
            `
                update tickets
                set
                    titulo = $1,
                    responsavel_id = $2,
                    agente_id = $3,
                    status = $4,
                    prioridade = $5,
                    ultima_atualizacao_em = now(),
                    fechado_em = case
                        when $6::boolean = true then coalesce(fechado_em, now())
                        else null
                    end,
                    fechado_por = case
                        when $6::boolean = true then coalesce(fechado_por, $7)
                        else null
                    end
                where id = $8
                    and empresa_id = $9
                returning
                    id,
                    titulo,
                    empresa_id,
                    produto_id,
                    responsavel_id,
                    agente_id,
                    status,
                    prioridade,
                    criado_em,
                    criado_por,
                    ultima_atualizacao_em,
                    fechado_em,
                    fechado_por
            `,
            [titulo, responsavelId, agenteId, status, prioridade, ticketEncerrado, idUsuario, id, empresaNavegacaoId]
        );

        try {
            await registrarAuditoriaSegura({
                acao: "UPDATE",
                usuarioId: idUsuario,
                empresaId: empresaNavegacaoId,
                metodo: request.method,
                rota: request.nextUrl.pathname,
                dadosAntes: resultadoTicketAntes.rows[0],
                dadosDepois: resultadoTicketDepois.rows[0],
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

        return criarRespostaApi(true, "Ticket atualizado com sucesso.", null);
    } catch (erro) {
        if (erroComCodigo(erro) && erro.code === "23503") {
            return criarRespostaApi(false, "Empresa, produto ou usuário informado não foi encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível atualizar o ticket.", null, 500);
    }
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

        const formData = await request.formData();
        const titulo = validarStringComConteudo(formData.get("titulo")) ? String(formData.get("titulo")).trim() : "";
        const empresaId = normalizarId(formData.get("empresaId"));
        const produtoId = normalizarId(formData.get("produtoId"));
        const responsavelId = normalizarId(formData.get("responsavelId"));
        const prioridade = validarStringComConteudo(formData.get("prioridade")) ? String(formData.get("prioridade")).trim() : "";
        const mensagemInicial = validarStringComConteudo(formData.get("mensagemInicial")) ? String(formData.get("mensagemInicial")).trim() : "";
        const anexos = formData.getAll("anexos").filter((valor): valor is File => valor instanceof File);
        const textoMensagemInicial = obterTextoMensagem(mensagemInicial);

        if (titulo.length < 5 || titulo.length > 50) {
            return criarRespostaApi(false, "O título deve ter entre 5 e 50 caracteres.", null, 400);
        }

        if (!empresaId || !produtoId || !responsavelId) {
            return criarRespostaApi(false, "Informe empresa, produto e responsável para criar o ticket.", null, 400);
        }


        if (!textoMensagemInicial) {
            return criarRespostaApi(false, "Informe a mensagem inicial para abrir o ticket.", null, 400);
        }

        const erroAnexos = validarAnexos(anexos);

        if (erroAnexos) {
            return criarRespostaApi(false, erroAnexos, null, 400);
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
            [ticketId, mensagemInicial, idUsuario]
        );
        const mensagemId = resultadoMensagem.rows[0]?.id;

        if (!mensagemId) {
            throw new Error("Mensagem inicial não retornada após o cadastro.");
        }

        await inserirAnexosMensagem({
            cliente,
            ticketId,
            mensagemId,
            anexos,
            idUsuario,
        });

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

        try {
            await registrarAuditoriaSegura({
                acao: "CREATE",
                usuarioId: idUsuario,
                empresaId,
                metodo: request.method,
                rota: request.nextUrl.pathname,
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

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
