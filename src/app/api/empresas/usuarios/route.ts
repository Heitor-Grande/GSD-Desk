import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { verificarUsuarioAdministrador } from "@/utils/usuarioAdmin";

type EntidadeAtiva = {
    id: number;
    ativo: boolean;
};

type UsuarioVinculadoListado = {
    id: number;
    usuario_id: number;
    nome: string;
    email: string | null;
    empresa_padrao: boolean;
};

type EmpresaVinculadaListado = {
    id: number;
    empresa_id: number;
    fantasia: string;
    cnpj: string;
    empresa_padrao: boolean;
};

type UsuarioDisponivel = {
    id: number;
    nome: string;
    email: string;
};

type EmpresaDisponivel = {
    id: number;
    fantasia: string;
    cnpj: string;
};

type VinculoRemovido = {
    id: number;
    usuario_id: number;
    empresa_id: number;
};

type VinculoUsuarioEmpresaBody = {
    empresaId?: unknown;
    usuarioId?: unknown;
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
 * Endpoint GET de vínculos entre usuários e empresas.
 * Use para listar vínculos ou opções disponíveis a partir de um usuário ou de uma empresa.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "usuario",
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
            return criarRespostaApi(false, "Apenas usuários administradores podem visualizar vínculos.", null, 403);
        }

        const empresaId = Number(request.nextUrl.searchParams.get("empresaId"));
        const usuarioId = Number(request.nextUrl.searchParams.get("usuarioId"));
        const listarDisponiveis = request.nextUrl.searchParams.get("disponiveis") === "true";
        const possuiEmpresa = validarIdPositivo(empresaId);
        const possuiUsuario = validarIdPositivo(usuarioId);

        if (possuiEmpresa === possuiUsuario) {
            return criarRespostaApi(false, "Informe usuário ou empresa para consultar os vínculos.", null, 400);
        }

        if (possuiEmpresa) {
            const resultadoEmpresa = await consultarBancoDados<EntidadeAtiva>(
                "select id, ativo from empresas where id = $1 limit 1",
                [empresaId]
            );
            const empresa = resultadoEmpresa.rows[0];

            if (!empresa) {
                return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
            }

            if (!empresa.ativo) {
                return criarRespostaApi(false, "Não é possível consultar vínculos de uma empresa inativa.", null, 400);
            }
        }

        if (possuiUsuario) {
            const resultadoUsuario = await consultarBancoDados<EntidadeAtiva>(
                "select id, ativo from usuarios where id = $1 limit 1",
                [usuarioId]
            );
            const usuario = resultadoUsuario.rows[0];

            if (!usuario) {
                return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
            }

            if (!usuario.ativo) {
                return criarRespostaApi(false, "Não é possível consultar vínculos de um usuário inativo.", null, 400);
            }
        }

        if (possuiEmpresa && listarDisponiveis) {
            const resultadoDisponiveis = await consultarBancoDados<UsuarioDisponivel>(
                `
                    select
                        u.id,
                        u.nome,
                        u.email
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

        if (possuiUsuario && listarDisponiveis) {
            const resultadoDisponiveis = await consultarBancoDados<EmpresaDisponivel>(
                `
                    select
                        e.id,
                        e.fantasia,
                        e.cnpj
                    from empresas e
                    where e.ativo = true
                        and not exists (
                            select 1
                            from usuarios_empresas ue
                            where ue.empresa_id = e.id
                                and ue.usuario_id = $1
                        )
                    order by e.fantasia asc
                `,
                [usuarioId]
            );

            return criarRespostaApi(true, "Empresas disponíveis listadas com sucesso.", resultadoDisponiveis.rows);
        }

        if (possuiEmpresa) {
            const resultado = await consultarBancoDados<UsuarioVinculadoListado>(
                `
                    select
                        ue.id,
                        ue.usuario_id,
                        u.nome,
                        u.email,
                        (u.empresa_padrao = ue.empresa_id) as empresa_padrao
                    from usuarios_empresas ue
                    inner join usuarios u on u.id = ue.usuario_id
                    where ue.empresa_id = $1
                    order by u.nome asc
                `,
                [empresaId]
            );

            return criarRespostaApi(true, "Usuários vinculados listados com sucesso.", resultado.rows);
        }

        const resultado = await consultarBancoDados<EmpresaVinculadaListado>(
            `
                select
                    ue.id,
                    ue.empresa_id,
                    e.fantasia,
                    e.cnpj,
                    (u.empresa_padrao = ue.empresa_id) as empresa_padrao
                from usuarios_empresas ue
                inner join usuarios u on u.id = ue.usuario_id
                inner join empresas e on e.id = ue.empresa_id
                where ue.usuario_id = $1
                order by e.fantasia asc
            `,
            [usuarioId]
        );

        return criarRespostaApi(true, "Empresas vinculadas listadas com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi(false, "Não foi possível listar os vínculos.", null, 500);
    }
}

/**
 * Endpoint POST de vínculo entre usuário e empresa.
 * Valida usuário, empresa, duplicidade e ajusta a empresa padrão quando necessário.
 */
export async function POST(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "usuario",
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
            return criarRespostaApi(false, "Apenas usuários administradores podem criar vínculos.", null, 403);
        }

        const body = await request.json() as VinculoUsuarioEmpresaBody;
        const empresaId = normalizarId(body.empresaId);
        const usuarioId = normalizarId(body.usuarioId);

        if (!validarIdPositivo(empresaId) || !validarIdPositivo(usuarioId)) {
            return criarRespostaApi(false, "Informe empresa e usuário válidos para o vínculo.", null, 400);
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

        const resultadoEmpresa = await consultarBancoDados<EntidadeAtiva>(
            "select id, ativo from empresas where id = $1 limit 1",
            [empresaId]
        );
        const empresa = resultadoEmpresa.rows[0];

        if (!empresa) {
            return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
        }

        if (!empresa.ativo) {
            return criarRespostaApi(false, "Não é possível vincular uma empresa inativa.", null, 400);
        }

        const resultadoVinculoExistente = await consultarBancoDados<{ id: number }>(
            `
                select id
                from usuarios_empresas
                where usuario_id = $1
                    and empresa_id = $2
                limit 1
            `,
            [usuarioId, empresaId]
        );

        if (resultadoVinculoExistente.rows[0]) {
            return criarRespostaApi(false, "Este usuário já está vinculado à empresa.", null, 409);
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

        await consultarBancoDados(
            `
                update usuarios
                set empresa_padrao = $1,
                    atualizado_em = now()
                where id = $2
                    and empresa_padrao is null
            `,
            [empresaId, usuarioId]
        );

        return criarRespostaApi(true, "Vínculo criado com sucesso.", null, 201);
    } catch (erro) {
        const codigoErro = obterCodigoErroBanco(erro);

        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (codigoErro === "23505") {
            return criarRespostaApi(false, "Este usuário já está vinculado à empresa.", null, 409);
        }

        if (codigoErro === "23503") {
            return criarRespostaApi(false, "Empresa ou usuário não encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível criar o vínculo.", null, 500);
    }
}

/**
 * Endpoint PATCH de empresa padrão do usuário.
 * Use para tornar uma empresa já vinculada a empresa padrão do usuário.
 */
export async function PATCH(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "usuario",
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
            return criarRespostaApi(false, "Apenas usuários administradores podem editar vínculos.", null, 403);
        }

        const body = await request.json() as VinculoUsuarioEmpresaBody;
        const empresaId = normalizarId(body.empresaId);
        const usuarioId = normalizarId(body.usuarioId);

        if (!validarIdPositivo(empresaId) || !validarIdPositivo(usuarioId)) {
            return criarRespostaApi(false, "Informe empresa e usuário válidos para definir a empresa padrão.", null, 400);
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
            return criarRespostaApi(false, "Não é possível alterar a empresa padrão de um usuário inativo.", null, 400);
        }

        const resultadoEmpresa = await consultarBancoDados<EntidadeAtiva>(
            "select id, ativo from empresas where id = $1 limit 1",
            [empresaId]
        );
        const empresa = resultadoEmpresa.rows[0];

        if (!empresa) {
            return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
        }

        if (!empresa.ativo) {
            return criarRespostaApi(false, "Não é possível definir uma empresa inativa como padrão.", null, 400);
        }

        const resultadoVinculo = await consultarBancoDados<{ id: number }>(
            `
                select id
                from usuarios_empresas
                where usuario_id = $1
                    and empresa_id = $2
                limit 1
            `,
            [usuarioId, empresaId]
        );

        if (!resultadoVinculo.rows[0]) {
            return criarRespostaApi(false, "A empresa precisa estar vinculada ao usuário para ser definida como padrão.", null, 400);
        }

        await consultarBancoDados(
            `
                update usuarios
                set empresa_padrao = $1,
                    atualizado_em = now()
                where id = $2
            `,
            [empresaId, usuarioId]
        );

        return criarRespostaApi(true, "Empresa padrão atualizada com sucesso.", null);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível atualizar a empresa padrão.", null, 500);
    }
}

/**
 * Endpoint DELETE de vínculo entre usuário e empresa.
 * Remove fisicamente o vínculo e recalcula a empresa padrão do usuário quando necessário.
 */
export async function DELETE(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "usuario",
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
            return criarRespostaApi(false, "Apenas usuários administradores podem remover vínculos.", null, 403);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (!validarIdPositivo(id)) {
            return criarRespostaApi(false, "Informe um vínculo válido para remoção.", null, 400);
        }

        const resultado = await consultarBancoDados<VinculoRemovido>(
            `
                delete from usuarios_empresas
                where id = $1
                returning id,
                    usuario_id,
                    empresa_id
            `,
            [id]
        );
        const vinculoRemovido = resultado.rows[0];

        if (!vinculoRemovido) {
            return criarRespostaApi(false, "Vínculo não encontrado.", null, 404);
        }

        await consultarBancoDados(
            `
                update usuarios
                set empresa_padrao = (
                        select e.id
                        from usuarios_empresas ue
                        inner join empresas e on e.id = ue.empresa_id
                        where ue.usuario_id = $1
                            and e.ativo = true
                        order by ue.criado_em asc
                        limit 1
                    ),
                    atualizado_em = now()
                where id = $1
                    and empresa_padrao = $2
            `,
            [vinculoRemovido.usuario_id, vinculoRemovido.empresa_id]
        );

        return criarRespostaApi(true, "Vínculo removido com sucesso.", null);
    } catch {
        return criarRespostaApi(false, "Não foi possível remover o vínculo.", null, 500);
    }
}
