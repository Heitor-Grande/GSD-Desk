import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { criarRespostaApi } from "@/utils/respostaApi";

export type RecursoPermissao = "usuario" | "configuracao" | "perfil" | "dashboard";
export type AcaoPermissao = "visualizar" | "criar" | "atualizar" | "deletar";

type PermissaoPerfil = Record<AcaoPermissao, boolean>;
type PermissoesPerfil = Record<RecursoPermissao, PermissaoPerfil>;

type DadosPermissaoUsuario = {
    usuario_ativo: boolean;
    perfil_id: number | null;
    perfil_ativo: boolean | null;
    permissoes: PermissoesPerfil | null;
};

type ConfiguracaoPermissaoApi = {
    request: NextRequest;
    recurso: RecursoPermissao;
    acao: AcaoPermissao;
};

const recursosPermissao: RecursoPermissao[] = ["usuario", "configuracao", "perfil"];
const acoesPermissao: AcaoPermissao[] = ["visualizar", "criar", "atualizar", "deletar"];

/**
 * Confirma se o jsonb de permissões possui a estrutura esperada pelo template.
 * Use antes de acessar recurso/ação para evitar erro por payload incompleto.
 */
function validarEstruturaPermissoes(permissoes: unknown): permissoes is PermissoesPerfil {
    if (typeof permissoes !== "object" || permissoes === null) {
        return false;
    }

    const permissoesRecebidas = permissoes as Record<string, unknown>;

    return recursosPermissao.every((recurso) => {
        const permissoesRecurso = permissoesRecebidas[recurso];

        if (typeof permissoesRecurso !== "object" || permissoesRecurso === null) {
            return false;
        }

        const acoesRecebidas = permissoesRecurso as Record<string, unknown>;

        return acoesPermissao.every((acao) => typeof acoesRecebidas[acao] === "boolean");
    });
}

/**
 * Verifica se o usuário autenticado possui permissão para executar uma ação em uma rota de API.
 * Retorna null quando permitido ou uma resposta padronizada quando a sessão/permissão for inválida.
 */
export async function verificarPermissaoAPI({
    request,
    recurso,
    acao,
}: ConfiguracaoPermissaoApi): Promise<ReturnType<typeof criarRespostaApi<null>> | null> {
    const idUsuario = obterIdUsuarioAutenticado(request);

    if (!idUsuario) {
        return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
    }

    const resultado = await consultarBancoDados<DadosPermissaoUsuario>(
        `
            select
                coalesce(u.ativo, false) as usuario_ativo,
                u.perfil_id,
                p.ativo as perfil_ativo,
                p.permissoes
            from usuarios u
            left join perfil p on p.id = u.perfil_id
            where u.id = $1
            limit 1
        `,
        [idUsuario]
    );

    const dadosPermissao = resultado.rows[0];

    if (!dadosPermissao) {
        return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
    }

    if (!dadosPermissao.usuario_ativo) {
        return criarRespostaApi(false, "Usuário inativo.", null, 403);
    }

    if (!dadosPermissao.perfil_id) {
        return criarRespostaApi(false, "Usuário não possuí perfil de permissão vinculado.", null, 403);
    }

    if (dadosPermissao.perfil_ativo === null) {
        return criarRespostaApi(false, "O perfil vinculado ao usuário não existe.", null, 403);
    }

    if (!dadosPermissao.perfil_ativo) {
        return criarRespostaApi(false, "O perfil vinculado ao usuário está Inativo.", null, 403);
    }

    if (!validarEstruturaPermissoes(dadosPermissao.permissoes)) {
        return criarRespostaApi(false, "As permissões do perfil estão inválidas.", null, 403);
    }

    if (dadosPermissao.permissoes[recurso]?.[acao] !== true) {
        return criarRespostaApi(false, "Você não possui permissão para executar esta ação.", null, 403);
    }

    return null;
}
