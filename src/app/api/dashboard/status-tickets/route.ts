import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { normalizarNomePerfil, STATUS_INICIAL_TICKET } from "@/utils/tickets";

type ContextoDashboardTickets = {
    suporte_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

type QuantidadeStatusTicket = {
    status: string;
    quantidade: string;
};

type StatusTicketDashboard = {
    status: string;
    quantidade: number;
};

const statusTicketsDashboard = [
    STATUS_INICIAL_TICKET,
    "com_agente",
    "com_cliente",
    "encerrado_resolvido",
    "encerrado_nao_resolvido",
];

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
}

/**
 * Endpoint GET de status de tickets do dashboard.
 * Retorna apenas quantidades agregadas por status para a empresa de navegação.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "dashboard",
            acao: "visualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const empresaNavegacaoId = Number(request.nextUrl.searchParams.get("empresaNavegacaoId"));

        if (!validarIdPositivo(empresaNavegacaoId)) {
            return criarRespostaApi(false, "Informe uma empresa de navegação válida para carregar o dashboard.", null, 400);
        }

        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaNavegacaoId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        const resultadoContexto = await consultarBancoDados<ContextoDashboardTickets>(
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

        const perfilNormalizado = normalizarNomePerfil(contexto.perfil_nome);
        const usuarioAgenteSuporte = perfilNormalizado === "agente de suporte";
        const usuarioCliente = perfilNormalizado === "cliente";
        const usuarioClienteManager = perfilNormalizado === "cliente manager";

        const resultadoStatus = await consultarBancoDados<QuantidadeStatusTicket>(
            `
                select
                    t.status,
                    count(*)::text as quantidade
                from tickets t
                where t.empresa_id = $1
                    and t.status = any($6::text[])
                    and (
                        $5::boolean = true
                        or (
                            $3::boolean = true
                            and (
                                $4::boolean = false
                                or t.agente_id = $2
                                or t.status = $7
                            )
                        )
                        or (
                            $8::boolean = true
                            and t.responsavel_id = $2
                        )
                        or (
                            $3::boolean = false
                            and $5::boolean = false
                            and $8::boolean = false
                            and t.responsavel_id = $2
                        )
                    )
                group by t.status
            `,
            [
                empresaNavegacaoId,
                idUsuario,
                usuarioAgenteSuporte,
                contexto.suporte_visualiza_apenas_tickets_proprios,
                usuarioClienteManager,
                statusTicketsDashboard,
                STATUS_INICIAL_TICKET,
                usuarioCliente,
            ]
        );

        const quantidadePorStatus = new Map(
            resultadoStatus.rows.map((item) => [item.status, Number(item.quantidade)])
        );
        const dados: StatusTicketDashboard[] = statusTicketsDashboard.map((status) => ({
            status: status,
            quantidade: quantidadePorStatus.get(status) ?? 0,
        }));

        return criarRespostaApi(true, "Status dos tickets carregados com sucesso.", dados);
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar os status dos tickets.", null, 500);
    }
}
