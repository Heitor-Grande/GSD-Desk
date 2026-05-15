import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { normalizarCampoOpcional, validarStringComConteudo } from "@/utils/validacoes";

type RecursoPermissaoPerfil = "dashboard" | "usuario" | "configuracao" | "perfil";

type PermissaoPerfil = {
    criar: boolean;
    deletar: boolean;
    atualizar: boolean;
    visualizar: boolean;
};

type PerfilPermissoes = Record<RecursoPermissaoPerfil, PermissaoPerfil>;

type PerfilListado = {
    id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    permissoes: PerfilPermissoes;
    criado_em: Date;
};

type PerfilDetalhado = PerfilListado & {
    atualizado_em: Date;
};

type CadastroPerfilBody = {
    nome?: unknown;
    descricao?: unknown;
    permissoes?: unknown;
};

type AtualizacaoPerfilBody = CadastroPerfilBody & {
    id?: unknown;
    ativo?: unknown;
};

const recursosPermissao: RecursoPermissaoPerfil[] = ["dashboard", "usuario", "configuracao", "perfil"];
const acoesPermissao: Array<keyof PermissaoPerfil> = ["criar", "deletar", "atualizar", "visualizar"];

/**
 * Valida se o objeto de permissões possui todos os recursos e ações esperados pelo template.
 * Use antes de salvar permissões em jsonb para evitar estruturas incompletas.
 */
function validarPermissoesPerfil(permissoes: unknown): permissoes is PerfilPermissoes {
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
 * Endpoint GET de perfis.
 * Use para alimentar a listagem ou carregar um perfil selecionado com suas permissões.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "perfil",
            acao: "visualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (Number.isInteger(id) && id > 0) {
            const resultadoPerfil = await consultarBancoDados<PerfilDetalhado>(
                `
                    select
                        id,
                        nome,
                        descricao,
                        ativo,
                        permissoes,
                        criado_em,
                        atualizado_em
                    from perfil
                    where id = $1
                    limit 1
                `,
                [id]
            );

            const perfil = resultadoPerfil.rows[0];

            if (!perfil) {
                return criarRespostaApi(false, "Perfil não encontrado.", null, 404);
            }

            return criarRespostaApi(true, "Perfil carregado com sucesso.", perfil);
        }

        const resultado = await consultarBancoDados<PerfilListado>(
            `
                select
                    id,
                    nome,
                    descricao,
                    ativo,
                    permissoes,
                    criado_em
                from perfil
                order by criado_em desc
            `
        );

        return criarRespostaApi(true, "Perfis listados com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi<PerfilListado[]>(false, "Não foi possível listar os perfis.", [], 500);
    }
}

/**
 * Endpoint POST de perfis.
 * Valida dados básicos e cadastra o perfil com permissões em jsonb.
 */
export async function POST(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "perfil",
            acao: "criar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const body = await request.json() as CadastroPerfilBody;

        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const descricao = normalizarCampoOpcional(body.descricao);

        if (!nome || nome.length > 120 || (descricao && descricao.length > 240)) {
            return criarRespostaApi(false, "Informe nome e descrição dentro do limite permitido.", null, 400);
        }

        if (!validarPermissoesPerfil(body.permissoes)) {
            return criarRespostaApi(false, "Informe permissões válidas para o perfil.", null, 400);
        }

        await consultarBancoDados(
            `
                insert into perfil (
                    nome,
                    descricao,
                    permissoes
                )
                values ($1, $2, $3)
            `,
            [
                nome,
                descricao,
                JSON.stringify(body.permissoes),
            ]
        );

        return criarRespostaApi(true, "Perfil cadastrado com sucesso.", null, 201);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe um perfil cadastrado com este nome.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível cadastrar o perfil.", null, 500);
    }
}

/**
 * Endpoint PUT de perfis.
 * Atualiza dados cadastrais, status e permissões do perfil.
 */
export async function PUT(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "perfil",
            acao: "atualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const body = await request.json() as AtualizacaoPerfilBody;

        const id = typeof body.id === "number" ? body.id : Number(body.id);
        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const descricao = normalizarCampoOpcional(body.descricao);
        const ativo = typeof body.ativo === "boolean" ? body.ativo : null;

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe um perfil válido para atualização.", null, 400);
        }

        if (!nome || nome.length > 120 || (descricao && descricao.length > 240)) {
            return criarRespostaApi(false, "Informe nome e descrição dentro do limite permitido.", null, 400);
        }

        if (!validarPermissoesPerfil(body.permissoes)) {
            return criarRespostaApi(false, "Informe permissões válidas para o perfil.", null, 400);
        }

        const resultado = await consultarBancoDados<PerfilListado>(
            `
                update perfil
                set
                    nome = $1,
                    descricao = $2,
                    ativo = coalesce($3, ativo),
                    permissoes = $4,
                    atualizado_em = now()
                where id = $5
                returning id
            `,
            [
                nome,
                descricao,
                ativo,
                JSON.stringify(body.permissoes),
                id,
            ]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Perfil não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Perfil atualizado com sucesso.", null);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe um perfil cadastrado com este nome.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível atualizar o perfil.", null, 500);
    }
}

/**
 * Endpoint DELETE de perfis.
 * Remove o perfil pelo id informado na query string.
 */
export async function DELETE(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "perfil",
            acao: "deletar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe um perfil válido para exclusão.", null, 400);
        }

        const resultadoUsuariosVinculados = await consultarBancoDados<{ total: string }>(
            `
                select count(*)::text as total
                from usuarios
                where perfil_id = $1
            `,
            [id]
        );
        const totalUsuariosVinculados = Number(resultadoUsuariosVinculados.rows[0]?.total ?? 0);

        if (totalUsuariosVinculados > 0) {
            return criarRespostaApi(false, "Não é possível excluir um perfil vinculado a usuários.", null, 409);
        }

        const resultado = await consultarBancoDados<PerfilListado>(
            `
                delete from perfil
                where id = $1
                returning id
            `,
            [id]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Perfil não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Perfil excluído com sucesso.", null);
    } catch {
        return criarRespostaApi(false, "Não foi possível excluir o perfil.", null, 500);
    }
}
