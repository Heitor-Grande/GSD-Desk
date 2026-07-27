import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";

type EmpresaRegraTicket = {
    id: number;
    exigir_vinculo_produto: boolean;
};

type ProdutoFormularioTicket = {
    id: number;
    nome: string;
};

type UsuarioFormularioTicket = {
    id: number;
    nome: string;
    email: string | null;
    ativo: boolean;
    perfil_nome: string | null;
    agente_suporte: boolean;
};

type DadosFormularioEmpresaTicket = {
    empresa: {
        id: number;
        exigirVinculoProduto: boolean;
    };
    produtos: Array<{
        id: number;
        nome: string;
    }>;
    usuariosAtivos: Array<{
        id: number;
        nome: string;
        email: string | null;
        perfilNome: string | null;
        agenteSuporte: boolean;
    }>;
    agentesSuporte: Array<{
        id: number;
        nome: string;
        email: string | null;
        perfilNome: string | null;
    }>;
    usuariosHistorico: Array<{
        id: number;
        nome: string;
        email: string | null;
        ativo: boolean;
        perfilNome: string | null;
    }>;
};

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
}

/**
 * Endpoint GET de dados do formulário de ticket dependentes da empresa.
 * Aplica a regra de vínculo de produtos e lista usuários/agentes para os seletores.
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

        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));

        if (!validarIdPositivo(empresaId)) {
            return criarRespostaApi(false, "Informe uma empresa válida para carregar o formulário.", null, 400);
        }

        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Empresa não vinculada ao usuário autenticado.", null, 403);
        }

        const resultadoEmpresa = await consultarBancoDados<EmpresaRegraTicket>(
            `
                select
                    id,
                    exigir_vinculo_produto
                from empresas
                where id = $1
                    and ativo = true
                limit 1
            `,
            [empresaId]
        );
        const empresa = resultadoEmpresa.rows[0];

        if (!empresa) {
            return criarRespostaApi(false, "Empresa não encontrada ou inativa.", null, 404);
        }

        const resultadoProdutos = await consultarBancoDados<ProdutoFormularioTicket>(
            empresa.exigir_vinculo_produto
                ? `
                    select
                        p.id,
                        p.nome
                    from produtos p
                    inner join usuarios_produtos up on up.produto_id = p.id
                        and up.empresa_id = p.empresa_id
                        and up.usuario_id = $2
                    where p.empresa_id = $1
                        and p.ativo = true
                    order by p.nome asc
                `
                : `
                    select
                        p.id,
                        p.nome
                    from produtos p
                    where p.empresa_id = $1
                        and p.ativo = true
                    order by p.nome asc
                `,
            empresa.exigir_vinculo_produto ? [empresaId, idUsuario] : [empresaId]
        );

        const resultadoUsuarios = await consultarBancoDados<UsuarioFormularioTicket>(
            `
                select
                    u.id,
                    u.nome,
                    u.email,
                    u.ativo,
                    p.nome as perfil_nome,
                    lower(coalesce(p.nome, '')) = 'agente de suporte' as agente_suporte
                from usuarios_empresas ue
                inner join usuarios u on u.id = ue.usuario_id
                left join perfil p on p.id = u.perfil_id
                where ue.empresa_id = $1
                order by u.ativo desc, u.nome asc
            `,
            [empresaId]
        );
        const resultadoUsuariosHistorico = await consultarBancoDados<UsuarioFormularioTicket>(
            `
                select
                    u.id,
                    u.nome,
                    u.email,
                    u.ativo,
                    p.nome as perfil_nome,
                    lower(coalesce(p.nome, '')) = 'agente de suporte' as agente_suporte
                from usuarios u
                left join perfil p on p.id = u.perfil_id
                order by u.ativo desc, u.nome asc
            `
        );

        const usuariosAtivos = resultadoUsuarios.rows.filter((usuario) => usuario.ativo && !usuario.agente_suporte);
        const usuariosAtivosComAgentes = resultadoUsuarios.rows.filter((usuario) => usuario.ativo);
        const agentesSuporte = usuariosAtivosComAgentes.filter((usuario) => usuario.agente_suporte);

        return criarRespostaApi<DadosFormularioEmpresaTicket>(
            true,
            "Dados da empresa carregados com sucesso.",
            {
                empresa: {
                    id: empresa.id,
                    exigirVinculoProduto: empresa.exigir_vinculo_produto,
                },
                produtos: resultadoProdutos.rows.map((produto) => ({
                    id: produto.id,
                    nome: produto.nome,
                })),
                usuariosAtivos: usuariosAtivos.map((usuario) => ({
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfilNome: usuario.perfil_nome,
                    agenteSuporte: usuario.agente_suporte,
                })),
                agentesSuporte: agentesSuporte.map((usuario) => ({
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    perfilNome: usuario.perfil_nome,
                })),
                usuariosHistorico: resultadoUsuariosHistorico.rows.map((usuario) => ({
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    ativo: usuario.ativo,
                    perfilNome: usuario.perfil_nome,
                })),
            }
        );
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar os dados da empresa.", null, 500);
    }
}
