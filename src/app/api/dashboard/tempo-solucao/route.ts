import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { normalizarNomePerfil } from "@/utils/tickets";

type ContextoDashboardTickets = {
    suporte_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

type TempoMedioSolucaoBanco = {
    tempo_medio_minutos: string | null;
    total_tickets_considerados: string;
};

type TempoMedioSolucaoDashboard = {
    tempoMedioMinutos: number | null;
    totalTicketsConsiderados: number;
};

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
}

/**
 * Endpoint GET de tempo médio de solução.
 * Retorna apenas dados agregados de tickets fechados para alimentar o dashboard.
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
        const usuarioAdministrador = perfilNormalizado === "admin";

        const resultadoTempoMedio = await consultarBancoDados<TempoMedioSolucaoBanco>(
            `
                select
                    avg(extract(epoch from (t.fechado_em - t.criado_em)) / 60)::text as tempo_medio_minutos,
                    count(*)::text as total_tickets_considerados
                from tickets t
                where t.empresa_id = $1
                    and t.fechado_em is not null
                    and (
                        $5::boolean = true
                        or $7::boolean = true
                        or (
                            $3::boolean = true
                            and (
                                $4::boolean = false
                                or t.agente_id = $2
                            )
                        )
                        or (
                            $6::boolean = true
                            and t.responsavel_id = $2
                        )
                        or (
                            $3::boolean = false
                            and $5::boolean = false
                            and $6::boolean = false
                            and $7::boolean = false
                            and t.responsavel_id = $2
                        )
                    )
            `,
            [
                empresaNavegacaoId,
                idUsuario,
                usuarioAgenteSuporte,
                contexto.suporte_visualiza_apenas_tickets_proprios,
                usuarioClienteManager,
                usuarioCliente,
                usuarioAdministrador,
            ]
        );
        const tempoMedio = resultadoTempoMedio.rows[0];
        const tempoMedioMinutos = tempoMedio?.tempo_medio_minutos
            ? Number(tempoMedio.tempo_medio_minutos)
            : null;
        const dados: TempoMedioSolucaoDashboard = {
            tempoMedioMinutos: Number.isFinite(tempoMedioMinutos) ? tempoMedioMinutos : null,
            totalTicketsConsiderados: Number(tempoMedio?.total_tickets_considerados ?? 0),
        };

        return criarRespostaApi(true, "Tempo médio de solução carregado com sucesso.", dados);
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar o tempo médio de solução.", null, 500);
    }
}
