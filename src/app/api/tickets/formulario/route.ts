import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";

type EmpresaFormularioTicket = {
    id: number;
    fantasia: string;
    ativo: boolean;
    empresa_padrao: boolean;
};

type UsuarioAutenticadoFormularioTicket = {
    id: number;
    nome: string;
    email: string;
    perfil_nome: string | null;
    agente_suporte: boolean;
};

type DadosFormularioTicket = {
    usuarioAutenticado: {
        id: number;
        nome: string;
        email: string;
        perfilNome: string | null;
        agenteSuporte: boolean;
    };
    empresas: Array<{
        id: number;
        fantasia: string;
        ativo: boolean;
        empresaPadrao: boolean;
    }>;
};

/**
 * Endpoint GET de dados iniciais do formulário de ticket.
 * Lista empresas ativas vinculadas ao usuário e informa se o usuário autenticado é Agente de Suporte.
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

        const resultadoUsuario = await consultarBancoDados<UsuarioAutenticadoFormularioTicket>(
            `
                select
                    u.id,
                    u.nome,
                    u.email,
                    p.nome as perfil_nome,
                    lower(coalesce(p.nome, '')) = 'agente de suporte' as agente_suporte
                from usuarios u
                left join perfil p on p.id = u.perfil_id
                where u.id = $1
                    and u.ativo = true
                limit 1
            `,
            [idUsuario]
        );
        const usuario = resultadoUsuario.rows[0];

        if (!usuario) {
            return criarRespostaApi(false, "Usuário não encontrado ou inativo.", null, 404);
        }

        const resultadoEmpresas = await consultarBancoDados<EmpresaFormularioTicket>(
            `
                select
                    e.id,
                    e.fantasia,
                    e.ativo,
                    u.empresa_padrao = e.id as empresa_padrao
                from usuarios_empresas ue
                inner join empresas e on e.id = ue.empresa_id
                inner join usuarios u on u.id = ue.usuario_id
                where ue.usuario_id = $1
                    and e.ativo = true
                order by
                    u.empresa_padrao = e.id desc,
                    e.fantasia asc
            `,
            [idUsuario]
        );

        return criarRespostaApi<DadosFormularioTicket>(
            true,
            "Dados do formulário carregados com sucesso.",
            {
                usuarioAutenticado: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfilNome: usuario.perfil_nome,
                    agenteSuporte: usuario.agente_suporte,
                },
                empresas: resultadoEmpresas.rows.map((empresa) => ({
                    id: empresa.id,
                    fantasia: empresa.fantasia,
                    ativo: empresa.ativo,
                    empresaPadrao: empresa.empresa_padrao,
                })),
            }
        );
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar os dados do formulário.", null, 500);
    }
}
