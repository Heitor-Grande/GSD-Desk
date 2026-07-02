import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";

type ContextoDashboardTickets = {
    suporte_visualiza_apenas_tickets_proprios: boolean;
};

type TempoMedioPrimeiraRespostaBanco = {
    tempo_medio_minutos: string | null;
    total_tickets_considerados: string;
};

type TempoMedioPrimeiraRespostaDashboard = {
    tempoMedioMinutos: number | null;
    totalTicketsConsiderados: number;
};

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
}

/**
 * Endpoint GET de tempo médio de primeira resposta do agente.
 * Retorna apenas dados agregados para alimentar o card do dashboard.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "ticket",
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
                    e.suporte_visualiza_apenas_tickets_proprios
                from empresas e
                where e.id = $1
                    and e.ativo = true
                limit 1
            `,
            [empresaNavegacaoId]
        );
        const contexto = resultadoContexto.rows[0];

        if (!contexto) {
            return criarRespostaApi(false, "Empresa não encontrada ou inativa.", null, 404);
        }

        const resultadoTempoMedio = await consultarBancoDados<TempoMedioPrimeiraRespostaBanco>(
            `
                select
                    avg(extract(epoch from (primeira_resposta.enviado_em - t.criado_em)) / 60)::text as tempo_medio_minutos,
                    count(*)::text as total_tickets_considerados
                from tickets t
                inner join lateral (
                    select tm.enviado_em
                    from ticket_mensagens tm
                    where tm.ticket_id = t.id
                        and tm.enviado_por = t.agente_id
                    order by tm.enviado_em asc, tm.id asc
                    limit 1
                ) primeira_resposta on true
                where t.empresa_id = $1
                    and t.agente_id is not null
                    and (
                        $3::boolean = false
                        or t.agente_id = $2
                        or t.responsavel_id = $2
                    )
            `,
            [
                empresaNavegacaoId,
                idUsuario,
                contexto.suporte_visualiza_apenas_tickets_proprios,
            ]
        );
        const tempoMedio = resultadoTempoMedio.rows[0];
        const tempoMedioMinutos = tempoMedio?.tempo_medio_minutos
            ? Number(tempoMedio.tempo_medio_minutos)
            : null;
        const dados: TempoMedioPrimeiraRespostaDashboard = {
            tempoMedioMinutos: Number.isFinite(tempoMedioMinutos) ? tempoMedioMinutos : null,
            totalTicketsConsiderados: Number(tempoMedio?.total_tickets_considerados ?? 0),
        };

        return criarRespostaApi(true, "Tempo médio de primeira resposta carregado com sucesso.", dados);
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar o tempo médio de primeira resposta.", null, 500);
    }
}
