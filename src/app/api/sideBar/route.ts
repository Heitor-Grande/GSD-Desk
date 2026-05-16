import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { criarRespostaApi } from "@/utils/respostaApi";

type RecursoPermissao = "dashboard" | "usuario" | "empresa" | "configuracao" | "perfil";
type AcaoPermissao = "visualizar" | "criar" | "atualizar" | "deletar";
type PermissoesPerfil = Record<RecursoPermissao, Record<AcaoPermissao, boolean>>;

type VerificacaoSideBar = {
    usuario_ativo: boolean;
    disponibilidade: string | null;
    fantasia: string | null;
    perfil_id: number | null;
    perfil_ativo: boolean | null;
    permissoes: PermissoesPerfil | null;
};

type DadosVerificacaoSideBar = {
    acessoPermitido: boolean;
    fantasiaEmpresa: string;
    permissoes: PermissoesPerfil | null;
};

/**
 * Endpoint GET de verificação da sidebar.
 * Use para confirmar acesso interno e carregar dados mínimos do layout e permissões do perfil.
 */
export async function GET(request: NextRequest) {
    try {
        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi<DadosVerificacaoSideBar>(
                false,
                "Sessão inválida ou expirada.",
                {
                    acessoPermitido: false,
                    fantasiaEmpresa: "",
                    permissoes: null,
                },
                401
            );
        }

        const resultado = await consultarBancoDados<VerificacaoSideBar>(
            `
                select
                    coalesce(u.ativo, false) as usuario_ativo,
                    c.disponibilidade,
                    c.fantasia,
                    u.perfil_id,
                    p.ativo as perfil_ativo,
                    p.permissoes
                from usuarios u
                left join perfil p on p.id = u.perfil_id
                cross join lateral (
                    select
                        disponibilidade,
                        fantasia
                    from configuracao
                    limit 1
                ) c
                where u.id = $1
                limit 1
            `,
            [idUsuario]
        );

        const verificacao = resultado.rows[0];
        const acessoPermitido = Boolean(
            verificacao?.usuario_ativo
            && verificacao.disponibilidade === "disponivel"
            && verificacao.perfil_id
            && verificacao.perfil_ativo
        );

        if (!acessoPermitido) {
        
            return criarRespostaApi<DadosVerificacaoSideBar>(
                false,
                "Usuário inativo, sem perfil válido ou aplicação indisponível.",
                {
                    acessoPermitido: false,
                    fantasiaEmpresa: verificacao?.fantasia ?? "",
                    permissoes: null,
                },
                403
            );
        }

        return criarRespostaApi<DadosVerificacaoSideBar>(
            true,
            "Acesso liberado.",
            {
                acessoPermitido: true,
                fantasiaEmpresa: verificacao.fantasia ?? "GSD Desk",
                permissoes: verificacao.permissoes,
            }
        );
    } catch {
       
        return criarRespostaApi<DadosVerificacaoSideBar>(
            false,
            "Não foi possível verificar o acesso.",
            {
                acessoPermitido: false,
                fantasiaEmpresa: "",
                permissoes: null,
            },
            500
        );
    }
}
