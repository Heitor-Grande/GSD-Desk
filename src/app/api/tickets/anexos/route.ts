import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { usuarioPodeVisualizarTicket } from "@/utils/tickets";

type ContextoTicketAnexo = {
    id: number;
    empresa_id: number;
    responsavel_id: number;
    agente_id: number | null;
    status: string;
    suporte_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

type AnexoTicket = {
    id: number;
    ticket_id: number;
    nome_original: string;
    mime_type: string;
    arquivo: Buffer;
};

function normalizarId(valor: unknown): number | null {
    const id = Number(valor);

    return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizarNomeArquivo(nomeOriginal: string): string {
    return nomeOriginal.replace(/[\r\n"]/g, "").trim() || "anexo";
}

/**
 * Endpoint GET de download de anexos das mensagens de ticket.
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

        const anexoId = normalizarId(request.nextUrl.searchParams.get("id"));

        if (!anexoId) {
            return criarRespostaApi(false, "Informe um anexo válido.", null, 400);
        }

        const resultadoAnexo = await consultarBancoDados<AnexoTicket>(
            `
                select
                    id,
                    ticket_id,
                    nome_original,
                    mime_type,
                    arquivo
                from ticket_mensagens_anexos
                where id = $1
                limit 1
            `,
            [anexoId]
        );
        const anexo = resultadoAnexo.rows[0];

        if (!anexo) {
            return criarRespostaApi(false, "Anexo não encontrado.", null, 404);
        }

        const resultadoContexto = await consultarBancoDados<ContextoTicketAnexo>(
            `
                select
                    t.id,
                    t.empresa_id,
                    t.responsavel_id,
                    t.agente_id,
                    t.status,
                    e.suporte_visualiza_apenas_tickets_proprios,
                    p.nome as perfil_nome
                from tickets t
                inner join empresas e on e.id = t.empresa_id
                inner join usuarios u on u.id = $2
                left join perfil p on p.id = u.perfil_id
                where t.id = $1
                limit 1
            `,
            [anexo.ticket_id, idUsuario]
        );
        const contexto = resultadoContexto.rows[0];

        if (!contexto) {
            return criarRespostaApi(false, "Ticket não encontrado.", null, 404);
        }

        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: contexto.empresa_id,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        if (!usuarioPodeVisualizarTicket({ ticket: contexto, idUsuario, contexto })) {
            return criarRespostaApi(false, "Você não possui permissão para baixar este anexo.", null, 403);
        }

        return new Response(new Uint8Array(anexo.arquivo), {
            headers: {
                "Content-Type": anexo.mime_type,
                "Content-Disposition": `attachment; filename="${normalizarNomeArquivo(anexo.nome_original)}"`,
            },
        });
    } catch {
        return criarRespostaApi(false, "Não foi possível baixar o anexo.", null, 500);
    }
}
