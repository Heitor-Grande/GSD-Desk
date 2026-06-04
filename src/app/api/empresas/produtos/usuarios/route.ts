import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { registrarAuditoriaSegura } from "@/utils/auditoria";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { verificarUsuarioAdministrador } from "@/utils/usuarioAdmin";

type EntidadeAtiva = {
    id: number;
    ativo: boolean;
};

type UsuarioProdutoListado = {
    id: number;
    usuario_id: number;
    nome: string;
    email: string | null;
};

type UsuarioDisponivelProduto = {
    id: number;
    nome: string;
    email: string;
};

type VinculoUsuarioProdutoBody = {
    empresaId?: unknown;
    produtoId?: unknown;
    usuarioId?: unknown;
};

type VinculoRemovido = {
    id: number;
    empresa_id: number;
    produto_id: number;
    usuario_id: number;
};

function normalizarId(valor: unknown): number {
    return typeof valor === "number" ? valor : Number(valor);
}

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
}

function obterCodigoErroBanco(erro: unknown): string | null {
    return erro instanceof Error && "code" in erro && typeof erro.code === "string" ? erro.code : null;
}

/**
 * Valida empresa ativa, produto ativo pertencente à empresa e usuário ativo vinculado à empresa quando informado.
 */
async function validarContextoVinculoUsuarioProduto(
    empresaId: number,
    produtoId: number,
    usuarioId?: number
) {
    const resultadoEmpresa = await consultarBancoDados<EntidadeAtiva>(
        "select id, ativo from empresas where id = $1 limit 1",
        [empresaId]
    );
    const empresa = resultadoEmpresa.rows[0];

    if (!empresa) {
        return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
    }

    if (!empresa.ativo) {
        return criarRespostaApi(false, "Não é possível gerenciar vínculos de uma empresa inativa.", null, 400);
    }

    const resultadoProduto = await consultarBancoDados<EntidadeAtiva>(
        `
            select id, ativo
            from produtos
            where id = $1
                and empresa_id = $2
            limit 1
        `,
        [produtoId, empresaId]
    );
    const produto = resultadoProduto.rows[0];

    if (!produto) {
        return criarRespostaApi(false, "Produto não encontrado para esta empresa.", null, 404);
    }

    if (!produto.ativo) {
        return criarRespostaApi(false, "Não é possível vincular usuários a um produto inativo.", null, 400);
    }

    if (!usuarioId) {
        return null;
    }

    const resultadoUsuario = await consultarBancoDados<EntidadeAtiva>(
        "select id, ativo from usuarios where id = $1 limit 1",
        [usuarioId]
    );
    const usuario = resultadoUsuario.rows[0];

    if (!usuario) {
        return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
    }

    if (!usuario.ativo) {
        return criarRespostaApi(false, "Não é possível vincular um usuário inativo.", null, 400);
    }

    const resultadoVinculoEmpresa = await consultarBancoDados<{ id: number }>(
        `
            select id
            from usuarios_empresas
            where empresa_id = $1
                and usuario_id = $2
            limit 1
        `,
        [empresaId, usuarioId]
    );

    if (!resultadoVinculoEmpresa.rows[0]) {
        return criarRespostaApi(false, "O usuário precisa estar vinculado à empresa antes de ser vinculado ao produto.", null, 400);
    }

    return null;
}

/**
 * Endpoint GET de vínculos entre usuários e produto.
 * Lista usuários vinculados ao produto ou usuários da empresa disponíveis para vínculo.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "visualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuarioAutenticado = obterIdUsuarioAutenticado(request);

        if (!idUsuarioAutenticado) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const usuarioAdministrador = await verificarUsuarioAdministrador(idUsuarioAutenticado);

        if (!usuarioAdministrador) {
            return criarRespostaApi(false, "Apenas usuários administradores podem visualizar vínculos de produto.", null, 403);
        }

        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));
        const produtoId = Number(request.nextUrl.searchParams.get("produtoId"));
        const listarDisponiveis = request.nextUrl.searchParams.get("disponiveis") === "true";

        if (!validarIdPositivo(empresaId) || !validarIdPositivo(produtoId)) {
            return criarRespostaApi(false, "Informe empresa e produto válidos para consultar vínculos.", null, 400);
        }

        const respostaContexto = await validarContextoVinculoUsuarioProduto(empresaId, produtoId);

        if (respostaContexto) {
            return respostaContexto;
        }

        if (listarDisponiveis) {
            const resultadoDisponiveis = await consultarBancoDados<UsuarioDisponivelProduto>(
                `
                    select
                        u.id,
                        u.nome,
                        u.email
                    from usuarios_empresas ue
                    inner join usuarios u on u.id = ue.usuario_id
                    where ue.empresa_id = $1
                        and u.ativo = true
                        and not exists (
                            select 1
                            from usuarios_produtos up
                            where up.empresa_id = $1
                                and up.produto_id = $2
                                and up.usuario_id = u.id
                        )
                    order by u.nome asc
                `,
                [empresaId, produtoId]
            );

            return criarRespostaApi(true, "Usuários disponíveis listados com sucesso.", resultadoDisponiveis.rows);
        }

        const resultado = await consultarBancoDados<UsuarioProdutoListado>(
            `
                select
                    up.id,
                    up.usuario_id,
                    u.nome,
                    u.email
                from usuarios_produtos up
                inner join usuarios u on u.id = up.usuario_id
                where up.empresa_id = $1
                    and up.produto_id = $2
                order by u.nome asc
            `,
            [empresaId, produtoId]
        );

        return criarRespostaApi(true, "Usuários vinculados ao produto listados com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi(false, "Não foi possível listar os vínculos do produto.", null, 500);
    }
}

/**
 * Endpoint POST de vínculo entre usuário e produto.
 * Cria o vínculo físico quando usuário, produto e empresa são válidos.
 */
export async function POST(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "criar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuarioAutenticado = obterIdUsuarioAutenticado(request);

        if (!idUsuarioAutenticado) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const usuarioAdministrador = await verificarUsuarioAdministrador(idUsuarioAutenticado);

        if (!usuarioAdministrador) {
            return criarRespostaApi(false, "Apenas usuários administradores podem criar vínculos de produto.", null, 403);
        }

        const body = await request.json() as VinculoUsuarioProdutoBody;
        const empresaId = normalizarId(body.empresaId);
        const produtoId = normalizarId(body.produtoId);
        const usuarioId = normalizarId(body.usuarioId);

        if (!validarIdPositivo(empresaId) || !validarIdPositivo(produtoId) || !validarIdPositivo(usuarioId)) {
            return criarRespostaApi(false, "Informe empresa, produto e usuário válidos para o vínculo.", null, 400);
        }

        const respostaContexto = await validarContextoVinculoUsuarioProduto(empresaId, produtoId, usuarioId);

        if (respostaContexto) {
            return respostaContexto;
        }

        await consultarBancoDados(
            `
                insert into usuarios_produtos (
                    empresa_id,
                    usuario_id,
                    produto_id,
                    criado_por
                )
                values ($1, $2, $3, $4)
            `,
            [empresaId, usuarioId, produtoId, idUsuarioAutenticado]
        );

        await registrarAuditoriaSegura({
            acao: "CREATE",
            usuarioId: idUsuarioAutenticado,
            empresaId,
            metodo: request.method,
            rota: request.nextUrl.pathname,
        });

        return criarRespostaApi(true, "Usuário vinculado ao produto com sucesso.", null, 201);
    } catch (erro) {
        const codigoErro = obterCodigoErroBanco(erro);

        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (codigoErro === "23505") {
            return criarRespostaApi(false, "Este usuário já está vinculado ao produto.", null, 409);
        }

        if (codigoErro === "23503") {
            return criarRespostaApi(false, "Empresa, usuário ou produto não encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível criar o vínculo do produto.", null, 500);
    }
}

/**
 * Endpoint DELETE de vínculo entre usuário e produto.
 * Remove fisicamente o vínculo informado.
 */
export async function DELETE(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "deletar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuarioAutenticado = obterIdUsuarioAutenticado(request);

        if (!idUsuarioAutenticado) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const usuarioAdministrador = await verificarUsuarioAdministrador(idUsuarioAutenticado);

        if (!usuarioAdministrador) {
            return criarRespostaApi(false, "Apenas usuários administradores podem remover vínculos de produto.", null, 403);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));
        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));
        const produtoId = Number(request.nextUrl.searchParams.get("produtoId"));

        if (!validarIdPositivo(id) || !validarIdPositivo(empresaId) || !validarIdPositivo(produtoId)) {
            return criarRespostaApi(false, "Informe vínculo, empresa e produto válidos para remoção.", null, 400);
        }

        const respostaContexto = await validarContextoVinculoUsuarioProduto(empresaId, produtoId);

        if (respostaContexto) {
            return respostaContexto;
        }

        const resultado = await consultarBancoDados<VinculoRemovido>(
            `
                delete from usuarios_produtos
                where id = $1
                    and empresa_id = $2
                    and produto_id = $3
                returning id,
                    empresa_id,
                    produto_id,
                    usuario_id
            `,
            [id, empresaId, produtoId]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Vínculo do produto não encontrado.", null, 404);
        }

        await registrarAuditoriaSegura({
            acao: "DELETE",
            usuarioId: idUsuarioAutenticado,
            empresaId,
            metodo: request.method,
            rota: request.nextUrl.pathname,
            dadosAntes: resultado.rows[0],
        });

        return criarRespostaApi(true, "Vínculo do produto removido com sucesso.", null);
    } catch {
        return criarRespostaApi(false, "Não foi possível remover o vínculo do produto.", null, 500);
    }
}
