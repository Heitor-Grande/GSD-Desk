import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { registrarAuditoriaSegura } from "@/utils/auditoria";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { verificarUsuarioAdministrador } from "@/utils/usuarioAdmin";
import { normalizarCampoOpcional, validarStringComConteudo } from "@/utils/validacoes";

type EntidadeAtiva = {
    id: number;
    ativo: boolean;
};

type ProdutoListado = {
    id: number;
    empresa_id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    criado_em: Date;
    criado_por: number;
    atualizado_em: Date | null;
};

type TotalVinculos = {
    total: string;
};

type ProdutoBody = {
    id?: unknown;
    empresaId?: unknown;
    nome?: unknown;
    descricao?: unknown;
    ativo?: unknown;
};

function normalizarId(valor: unknown): number {
    return typeof valor === "number" ? valor : Number(valor);
}

function validarIdPositivo(valor: number): boolean {
    return Number.isInteger(valor) && valor > 0;
}

function obterBooleanoAtivo(valor: unknown): boolean {
    return typeof valor === "boolean" ? valor : true;
}

function obterCodigoErroBanco(erro: unknown): string | null {
    return erro instanceof Error && "code" in erro && typeof erro.code === "string" ? erro.code : null;
}

/**
 * Valida se a empresa informada existe e está ativa.
 * Use nas operações de produtos para manter o contexto fixo da empresa.
 */
async function validarEmpresaAtiva(empresaId: number) {
    const resultadoEmpresa = await consultarBancoDados<EntidadeAtiva>(
        "select id, ativo from empresas where id = $1 limit 1",
        [empresaId]
    );
    const empresa = resultadoEmpresa.rows[0];

    if (!empresa) {
        return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
    }

    if (!empresa.ativo) {
        return criarRespostaApi(false, "Não é possível gerenciar produtos de uma empresa inativa.", null, 400);
    }

    return null;
}

/**
 * Endpoint GET de produtos da empresa.
 * Lista somente produtos vinculados à empresa informada.
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
            return criarRespostaApi(false, "Apenas usuários administradores podem visualizar produtos.", null, 403);
        }

        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));

        if (!validarIdPositivo(empresaId)) {
            return criarRespostaApi(false, "Informe uma empresa válida para listar produtos.", null, 400);
        }

        const respostaEmpresa = await validarEmpresaAtiva(empresaId);

        if (respostaEmpresa) {
            return respostaEmpresa;
        }

        const resultado = await consultarBancoDados<ProdutoListado>(
            `
                select
                    id,
                    empresa_id,
                    nome,
                    descricao,
                    ativo,
                    criado_em,
                    criado_por,
                    atualizado_em
                from produtos
                where empresa_id = $1
                order by ativo desc, nome asc
            `,
            [empresaId]
        );

        return criarRespostaApi(true, "Produtos listados com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi(false, "Não foi possível listar os produtos.", null, 500);
    }
}

/**
 * Endpoint POST de produtos.
 * Cadastra um produto vinculado à empresa informada e ao usuário autenticado.
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
            return criarRespostaApi(false, "Apenas usuários administradores podem cadastrar produtos.", null, 403);
        }

        const body = await request.json() as ProdutoBody;
        const empresaId = normalizarId(body.empresaId);
        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const descricao = normalizarCampoOpcional(body.descricao);
        const ativo = obterBooleanoAtivo(body.ativo);

        if (!validarIdPositivo(empresaId)) {
            return criarRespostaApi(false, "Informe uma empresa válida para cadastrar o produto.", null, 400);
        }

        if (!nome || nome.length > 150) {
            return criarRespostaApi(false, "Informe o nome do produto com até 150 caracteres.", null, 400);
        }

        const respostaEmpresa = await validarEmpresaAtiva(empresaId);

        if (respostaEmpresa) {
            return respostaEmpresa;
        }

        const resultado = await consultarBancoDados<ProdutoListado>(
            `
                insert into produtos (
                    empresa_id,
                    nome,
                    descricao,
                    ativo,
                    criado_por
                )
                values ($1, $2, $3, $4, $5)
                returning id,
                    empresa_id,
                    nome,
                    descricao,
                    ativo,
                    criado_em,
                    criado_por,
                    atualizado_em
            `,
            [empresaId, nome, descricao, ativo, idUsuarioAutenticado]
        );

        await registrarAuditoriaSegura({
            acao: "CREATE",
            usuarioId: idUsuarioAutenticado,
            empresaId,
            metodo: request.method,
            rota: request.nextUrl.pathname,
        });

        return criarRespostaApi(true, "Produto cadastrado com sucesso.", resultado.rows[0], 201);
    } catch (erro) {
        const codigoErro = obterCodigoErroBanco(erro);

        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (codigoErro === "23505") {
            return criarRespostaApi(false, "Já existe um produto com este nome nesta empresa.", null, 409);
        }

        if (codigoErro === "23503") {
            return criarRespostaApi(false, "Empresa ou usuário não encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível cadastrar o produto.", null, 500);
    }
}

/**
 * Endpoint PUT de produtos.
 * Atualiza os dados do produto vinculado à empresa informada.
 */
export async function PUT(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "atualizar",
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
            return criarRespostaApi(false, "Apenas usuários administradores podem atualizar produtos.", null, 403);
        }

        const body = await request.json() as ProdutoBody;
        const id = normalizarId(body.id);
        const empresaId = normalizarId(body.empresaId);
        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const descricao = normalizarCampoOpcional(body.descricao);
        const ativo = obterBooleanoAtivo(body.ativo);

        if (!validarIdPositivo(id) || !validarIdPositivo(empresaId)) {
            return criarRespostaApi(false, "Informe produto e empresa válidos para atualização.", null, 400);
        }

        if (!nome || nome.length > 150) {
            return criarRespostaApi(false, "Informe o nome do produto com até 150 caracteres.", null, 400);
        }

        const respostaEmpresa = await validarEmpresaAtiva(empresaId);

        if (respostaEmpresa) {
            return respostaEmpresa;
        }

        const resultadoProdutoAntes = await consultarBancoDados<ProdutoListado>(
            `
                select
                    id,
                    empresa_id,
                    nome,
                    descricao,
                    ativo,
                    criado_em,
                    criado_por,
                    atualizado_em
                from produtos
                where id = $1
                    and empresa_id = $2
                limit 1
            `,
            [id, empresaId]
        );

        const resultado = await consultarBancoDados<ProdutoListado>(
            `
                update produtos
                set
                    nome = $1,
                    descricao = $2,
                    ativo = $3,
                    atualizado_em = now()
                where id = $4
                    and empresa_id = $5
                returning id,
                    empresa_id,
                    nome,
                    descricao,
                    ativo,
                    criado_em,
                    criado_por,
                    atualizado_em
            `,
            [nome, descricao, ativo, id, empresaId]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Produto não encontrado para esta empresa.", null, 404);
        }

        await registrarAuditoriaSegura({
            acao: "UPDATE",
            usuarioId: idUsuarioAutenticado,
            empresaId,
            metodo: request.method,
            rota: request.nextUrl.pathname,
            dadosAntes: resultadoProdutoAntes.rows[0],
            dadosDepois: resultado.rows[0],
        });

        return criarRespostaApi(true, "Produto atualizado com sucesso.", resultado.rows[0]);
    } catch (erro) {
        const codigoErro = obterCodigoErroBanco(erro);

        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (codigoErro === "23505") {
            return criarRespostaApi(false, "Já existe um produto com este nome nesta empresa.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível atualizar o produto.", null, 500);
    }
}

/**
 * Endpoint DELETE de produtos.
 * Remove fisicamente o produto informado, garantindo que ele pertence à empresa.
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
            return criarRespostaApi(false, "Apenas usuários administradores podem desativar produtos.", null, 403);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));
        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));

        if (!validarIdPositivo(id) || !validarIdPositivo(empresaId)) {
            return criarRespostaApi(false, "Informe produto e empresa válidos para desativação.", null, 400);
        }

        const respostaEmpresa = await validarEmpresaAtiva(empresaId);

        if (respostaEmpresa) {
            return respostaEmpresa;
        }

        const resultadoVinculos = await consultarBancoDados<TotalVinculos>(
            `
                select count(*) as total
                from usuarios_produtos
                where empresa_id = $1
                    and produto_id = $2
            `,
            [empresaId, id]
        );
        const totalVinculos = Number(resultadoVinculos.rows[0]?.total ?? 0);

        if (totalVinculos > 0) {
            return criarRespostaApi(false, "Não é possível excluir o produto, pois existem usuários vinculados a ele.", null, 409);
        }

        const resultado = await consultarBancoDados<ProdutoListado>(
            `
                delete from produtos
                where id = $1
                    and empresa_id = $2
                returning id,
                    empresa_id,
                    nome,
                    descricao,
                    ativo,
                    criado_em,
                    criado_por,
                    atualizado_em
            `,
            [id, empresaId]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Produto não encontrado para esta empresa.", null, 404);
        }

        await registrarAuditoriaSegura({
            acao: "DELETE",
            usuarioId: idUsuarioAutenticado,
            empresaId,
            metodo: request.method,
            rota: request.nextUrl.pathname,
            dadosAntes: resultado.rows[0],
        });

        return criarRespostaApi(true, "Produto excluído com sucesso.", resultado.rows[0]);
    } catch {
        return criarRespostaApi(false, "Não foi possível excluir o produto.", null, 500);
    }
}
