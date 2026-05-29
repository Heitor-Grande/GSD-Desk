import { NextRequest } from "next/server";
import { obterClienteBancoDados } from "@/services/database";
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
    agenteId?: unknown;
    status?: unknown;
    prioridade?: unknown;
    mensagemInicial?: unknown;
};

type ResultadoId = {
    id: number;
};

const statusPermitidos = ["com_agente", "com_cliente", "encerrado_resolvido", "encerrado_nao_resolvido"];
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

/**
 * Endpoint POST de tickets.
 * Cria o ticket e sua primeira mensagem na mesma transação.
 */
export async function POST(request: NextRequest) {
    let cliente: PoolClient | null = null;

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
        const agenteId = normalizarId(body.agenteId);
        const status = validarStringComConteudo(body.status) ? body.status.trim() : "";
        const prioridade = validarStringComConteudo(body.prioridade) ? body.prioridade.trim() : "";
        const mensagemInicial = validarStringComConteudo(body.mensagemInicial) ? body.mensagemInicial.trim() : "";
        const textoMensagemInicial = obterTextoMensagem(mensagemInicial);

        if (titulo.length < 5 || titulo.length > 50) {
            return criarRespostaApi(false, "O título deve ter entre 5 e 50 caracteres.", null, 400);
        }

        if (!empresaId || !produtoId || !responsavelId) {
            return criarRespostaApi(false, "Informe empresa, produto e responsável para criar o ticket.", null, 400);
        }

        if (!statusPermitidos.includes(status) || !prioridadesPermitidas.includes(prioridade)) {
            return criarRespostaApi(false, "Informe status e prioridade válidos para criar o ticket.", null, 400);
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
            agente_valido: boolean;
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
                    ) as responsavel_valido,
                    case
                        when $5::bigint is null then true
                        else exists (
                            select 1
                            from usuarios_empresas ue
                            inner join usuarios u on u.id = ue.usuario_id
                            left join perfil p on p.id = u.perfil_id
                            where ue.empresa_id = $1
                                and u.id = $5
                                and u.ativo = true
                                and lower(coalesce(p.nome, '')) = 'agente de suporte'
                        )
                    end as agente_valido
            `,
            [empresaId, produtoId, idUsuario, responsavelId, agenteId]
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

        if (!contexto.agente_valido) {
            return criarRespostaApi(false, "O agente deve ser um Agente de Suporte ativo vinculado à empresa.", null, 400);
        }

        await cliente.query("begin");

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
            [titulo, empresaId, produtoId, responsavelId, agenteId, status, prioridade, idUsuario]
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

        return criarRespostaApi(true, "Ticket criado com sucesso.", { id: ticketId }, 201);
    } catch (erro) {
        await cliente?.query("rollback").catch(() => undefined);

        if (erroComCodigo(erro) && erro.code === "23503") {
            return criarRespostaApi(false, "Empresa, produto ou usuário informado não foi encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível criar o ticket.", null, 500);
    } finally {
        cliente?.release();
    }
}
