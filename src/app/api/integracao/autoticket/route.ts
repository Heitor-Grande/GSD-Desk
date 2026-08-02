import { criarRespostaApi } from "@/utils/respostaApi";
import { verificarTokenAPI } from "@/utils/tokenApi";
import { consultarBancoDados } from "@/services/database";
import { STATUS_INICIAL_TICKET } from "@/utils/tickets";
import { registrarAuditoriaSegura } from "@/utils/auditoria";
import { NextRequest } from "next/server";
import { enviarEmail } from "@/services/email";
import { montarHtmlNovoTicket } from "../../tickets/route";

interface ticketInformacoesGerais {

    titulo: string;
    empresa_id: number;
    produto_id: number;
}

interface ticketDetalhes {

    conteudo: string;
}

interface bodyTicketApi {

    informacoes_gerais: ticketInformacoesGerais;
    detalhes: ticketDetalhes;
}

//rota para criar ticket de maneira automatica no gsd desk API
export async function POST(request: NextRequest) {

    try {

        const tokenApi = request.headers.get("Authorization")?.replace("Bearer ", "");

        if (tokenApi === undefined || tokenApi === null) {

            return criarRespostaApi(false, "Token de API não fornecido.", null, 401);
        }

        const result = verificarTokenAPI(tokenApi);

        if (result.sucesso === false) {

            return criarRespostaApi(false, result.message, null, 401);
        }

        //verificando se usuario ainda é ativo e existente
        const consultaUsuario = await consultarBancoDados("SELECT count(id) as total FROM usuarios WHERE id = $1 AND ativo = true", [result.payload?.id_usuario]);

        if (consultaUsuario.rows[0].total == 0) {

            return criarRespostaApi(false, "O usuário que gerou o token, não está ativo ou não existe. Gere um novo token para a empresa.", null, 401);
        }

        //pegando e verificando body
        const body: bodyTicketApi = await request.json();
        const informacoesGerais = body.informacoes_gerais;
        const detalhes = body.detalhes;

        if ((informacoesGerais === undefined || detalhes === undefined) || (informacoesGerais === null || detalhes === null)) {

            return criarRespostaApi(false, "Body inválido. Campos obrigatórios não fornecidos.", null, 400);
        }

        const titulo = informacoesGerais.titulo + ' - Api';
        const empresaId = informacoesGerais.empresa_id;
        const produtoId = informacoesGerais.produto_id;
        const conteudo = detalhes.conteudo;

        if (titulo === undefined || titulo == null) {

            return criarRespostaApi(false, "O campo titulo não foi fornecido.", null, 400);
        }

        if (titulo.length >= 50) {

            return criarRespostaApi(false, "O campo titulo não pode ter mais de 44 caracteres.", null, 400);
        }

        if (empresaId === undefined || empresaId == null) {

            return criarRespostaApi(false, "O campo empresa_id não foi fornecido.", null, 400);
        }

        if (produtoId === undefined || produtoId == null) {

            return criarRespostaApi(false, "O campo produto_id não foi fornecido.", null, 400);
        }

        if (conteudo === undefined || conteudo == null) {

            return criarRespostaApi(false, "O campo conteudo não foi fornecido.", null, 400);
        }

        //verificando se produto pertence a empresa
        const consulta = await consultarBancoDados("SELECT id, ativo FROM produtos WHERE id = $1 AND empresa_id = $2", [produtoId, empresaId]);

        if (consulta.rows.length === 0) {

            return criarRespostaApi(false, "O produto não pertence à empresa especificada.", null, 400);
        }

        if (consulta.rows[0].ativo === false) {

            return criarRespostaApi(false, "O produto especificado não está ativo.", null, 400);
        }

        //pegando algum usuario com perfil de "cliente manager"
        const consultaUsuarioClienteManager = await consultarBancoDados(`
        select 
        u.id,
        u.nome,
        e.fantasia,
        p.nome as nome_produto
        from usuarios u 
        inner join perfil on perfil.id = u.perfil_id
        inner join usuarios_empresas ue on ue.usuario_id = u.id
        inner join empresas e on e.id = ue.empresa_id
        inner join produtos p on p.id = $2
        where perfil.nome = 'Cliente Manager' and ue.empresa_id = $1 and u.ativo = true limit 1
        `, [empresaId, produtoId]);

        if (consultaUsuarioClienteManager.rows.length === 0) {

            return criarRespostaApi(false, "Não foi encontrado nenhum usuário com perfil 'Cliente Manager' ativo para a empresa especificada.", null, 400);
        }

        const responsavel = consultaUsuarioClienteManager.rows[0];

        //criando corpo ticket 
        const ticket = await consultarBancoDados(`
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
            `, [titulo, empresaId, produtoId, responsavel.id, null, STATUS_INICIAL_TICKET, "alta", responsavel.id])

        const ticketId = ticket.rows[0].id;

        //criando corpo ticket detalhes
        await consultarBancoDados(`
            insert into ticket_mensagens (
                    ticket_id,
                    conteudo,
                    enviado_por
                )
                values ($1, $2, $3)
            `, [ticketId, conteudo, responsavel.id])

        try {
            await registrarAuditoriaSegura({
                acao: "CREATE",
                usuarioId: parseInt(responsavel.id),
                empresaId: empresaId,
                metodo: request.method,
                rota: request.nextUrl.pathname,
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

        const resultadoAgentesNotificacao = await consultarBancoDados(
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

        if (emailsAgentes.length > 0) {
            await enviarEmail({
                to: emailsAgentes.join(","),
                subject: `Novo ticket aberto: ${titulo}`,
                html: montarHtmlNovoTicket({
                    titulo: titulo,
                    empresa: responsavel.fantasia,
                    produto: responsavel.nome_produto,
                    responsavel: responsavel.nome,
                }),
            });
        }

        return criarRespostaApi(true, "Ticket criado com sucesso.", { ticketId: ticketId }, 200);
    } catch (error) {

        console.error(error);
        return criarRespostaApi(false, "Erro ao processar a solicitação. Informe o suporte.", error, 500);
    }
}