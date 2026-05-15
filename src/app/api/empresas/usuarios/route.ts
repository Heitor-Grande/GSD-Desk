import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { criarRespostaApi } from "@/utils/respostaApi";

type UsuarioEmpresaListado = {
    id: number;
    usuario_id: number;
    empresa_id: number;
    nome: string;
    email: string;
    ativo: boolean;
    criado_em: Date;
};

type UsuarioDisponivel = {
    id: number;
    nome: string;
    email: string;
    ativo: boolean;
};

type VinculoUsuarioEmpresaBody = {
    empresaId?: unknown;
    usuarioId?: unknown;
};

function normalizarId(valor: unknown): number {
    return typeof valor === "number" ? valor : Number(valor);
}

/**
 * Endpoint GET de vínculos entre usuários e empresas.
 * Use para listar usuários vinculados ou usuários disponíveis para vínculo.
 */
export async function GET(request: NextRequest) {
    try {
        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));
        const listarDisponiveis = request.nextUrl.searchParams.get("disponiveis") === "true";

        if (!Number.isInteger(empresaId) || empresaId <= 0) {
            return criarRespostaApi(false, "Informe uma empresa válida.", null, 400);
        }

        if (listarDisponiveis) {
            const resultadoDisponiveis = await consultarBancoDados<UsuarioDisponivel>(
                `
                    select
                        u.id,
                        u.nome,
                        u.email,
                        u.ativo
                    from usuarios u
                    where u.ativo = true
                        and not exists (
                            select 1
                            from usuarios_empresas ue
                            where ue.usuario_id = u.id
                                and ue.empresa_id = $1
                        )
                    order by u.nome asc
                `,
                [empresaId]
            );

            return criarRespostaApi(true, "Usuários disponíveis listados com sucesso.", resultadoDisponiveis.rows);
        }

        const resultado = await consultarBancoDados<UsuarioEmpresaListado>(
            `
                select
                    ue.id,
                    ue.usuario_id,
                    ue.empresa_id,
                    u.nome,
                    u.email,
                    u.ativo,
                    ue.criado_em
                from usuarios_empresas ue
                inner join usuarios u on u.id = ue.usuario_id
                where ue.empresa_id = $1
                order by u.nome asc
            `,
            [empresaId]
        );

        return criarRespostaApi(true, "Usuários vinculados listados com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi<UsuarioEmpresaListado[]>(false, "Não foi possível listar os vínculos da empresa.", [], 500);
    }
}

/**
 * Endpoint POST de vínculo entre usuário e empresa.
 * Valida a existência dos ids e impede duplicidade pelo índice único da tabela.
 */
export async function POST(request: NextRequest) {
    try {
        const idUsuarioAutenticado = obterIdUsuarioAutenticado(request);

        if (!idUsuarioAutenticado) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const body = await request.json() as VinculoUsuarioEmpresaBody;
        const empresaId = normalizarId(body.empresaId);
        const usuarioId = normalizarId(body.usuarioId);

        if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(usuarioId) || usuarioId <= 0) {
            return criarRespostaApi(false, "Informe empresa e usuário válidos para o vínculo.", null, 400);
        }

        await consultarBancoDados(
            `
                insert into usuarios_empresas (
                    usuario_id,
                    empresa_id,
                    criado_por
                )
                values ($1, $2, $3)
            `,
            [usuarioId, empresaId, idUsuarioAutenticado]
        );

        return criarRespostaApi(true, "Usuário vinculado à empresa com sucesso.", null, 201);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Este usuário já está vinculado à empresa.", null, 409);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23503") {
            return criarRespostaApi(false, "Empresa ou usuário não encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível vincular o usuário à empresa.", null, 500);
    }
}

/**
 * Endpoint DELETE de vínculo entre usuário e empresa.
 * Remove o vínculo pelo id informado na query string sem excluir o usuário.
 */
export async function DELETE(request: NextRequest) {
    try {
        const idUsuarioAutenticado = obterIdUsuarioAutenticado(request);

        if (!idUsuarioAutenticado) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe um vínculo válido para remoção.", null, 400);
        }

        const resultado = await consultarBancoDados<UsuarioEmpresaListado>(
            `
                delete from usuarios_empresas
                where id = $1
                returning id,
                    usuario_id,
                    empresa_id,
                    ''::text as nome,
                    ''::text as email,
                    true as ativo,
                    criado_em
            `,
            [id]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Vínculo não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Vínculo removido com sucesso.", null);
    } catch {
        return criarRespostaApi(false, "Não foi possível remover o vínculo.", null, 500);
    }
}
