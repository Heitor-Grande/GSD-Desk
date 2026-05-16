import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { normalizarCampoOpcional, validarEmail, validarStringComConteudo } from "@/utils/validacoes";
import { criarHash } from "@/utils/criptografia";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarEmpresaPertenceAoUsuario } from "@/utils/empresaUsuario";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { verificarUsuarioAdministrador } from "@/utils/usuarioAdmin";

type UsuarioListado = {
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    documento: string | null;
    perfil_id: number | null;
    perfil_nome: string | null;
    ativo: boolean;
    criado_em: Date;
};

type UsuarioDetalhado = UsuarioListado & {
    isAdmin: boolean;
    atualizado_em: Date;
};

type CadastroUsuarioBody = {
    nome?: string;
    email?: string;
    senha?: string;
    confirmarSenha?: string;
    telefone?: string;
    documento?: string;
    perfilId?: unknown;
    empresaNavegacaoId?: unknown;
};

type AtualizacaoUsuarioBody = CadastroUsuarioBody & {
    id?: unknown;
    ativo?: unknown;
    isAdmin?: unknown;
};

function normalizarPerfilId(valor: unknown): number | null {
    if (valor === null || valor === "" || typeof valor === "undefined") {
        return null;
    }

    return Number(valor);
}

function normalizarIdEmpresaNavegacao(valor: unknown): number {
    return Number(valor);
}

/**
 * Endpoint GET de usuários.
 * Use para alimentar tabelas de listagem sem retornar dados sensíveis como senha_hash.
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

        const empresaNavegacaoId = normalizarIdEmpresaNavegacao(request.nextUrl.searchParams.get("empresaNavegacaoId"));

        if (!Number.isInteger(empresaNavegacaoId) || empresaNavegacaoId <= 0) {
            return criarRespostaApi(false, "Informe uma empresa de navegação válida.", null, 400);
        }

        const empresaPertenceAoUsuario = await verificarEmpresaPertenceAoUsuario({
            request: request,
            idEmpresa: empresaNavegacaoId,
        });

        if (!empresaPertenceAoUsuario) {
            return criarRespostaApi(false, "Você não possui vínculo com a empresa de navegação.", null, 403);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (Number.isInteger(id) && id > 0) {
            const resultadoUsuario = await consultarBancoDados<UsuarioDetalhado>(
                `
                    select
                        u.id,
                        u.nome,
                        u.email,
                        u.telefone,
                        u.documento,
                        u.perfil_id,
                        p.nome as perfil_nome,
                        u.ativo,
                        u."isAdmin",
                        u.criado_em,
                        u.atualizado_em
                    from usuarios u
                    inner join usuarios_empresas ue on ue.usuario_id = u.id
                    left join perfil p on p.id = u.perfil_id
                    where u.id = $1
                        and ue.empresa_id = $2
                    limit 1
                `,
                [id, empresaNavegacaoId]
            );

            const usuario = resultadoUsuario.rows[0];

            if (!usuario) {
                return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
            }

            return criarRespostaApi(true, "Usuário carregado com sucesso.", usuario);
        }

        const resultado = await consultarBancoDados<UsuarioListado>(
            `
                select
                    u.id,
                    u.nome,
                    u.email,
                    u.telefone,
                    u.documento,
                    u.perfil_id,
                    p.nome as perfil_nome,
                    u.ativo,
                    u.criado_em
                from usuarios u
                inner join usuarios_empresas ue on ue.usuario_id = u.id
                left join perfil p on p.id = u.perfil_id
                where ue.empresa_id = $1
                order by u.criado_em desc
            `,
            [empresaNavegacaoId]
        );

        return criarRespostaApi(true, "Usuários listados com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi<UsuarioListado[]>(false, "Não foi possível listar os usuários.", [], 500);
    }
}

/**
 * Endpoint POST de usuários.
 * Valida dados básicos, cria hash da senha e cadastra o usuário sem retornar dados sensíveis.
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

        const body = await request.json() as CadastroUsuarioBody;
        const empresaNavegacaoId = normalizarIdEmpresaNavegacao(body.empresaNavegacaoId);

        if (!Number.isInteger(empresaNavegacaoId) || empresaNavegacaoId <= 0) {
            return criarRespostaApi(false, "Informe uma empresa de navegação válida.", null, 400);
        }

        const idUsuarioCriador = obterIdUsuarioAutenticado(request);

        if (!idUsuarioCriador) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const usuarioAdministrador = await verificarUsuarioAdministrador(idUsuarioCriador);

        if (!usuarioAdministrador) {
            return criarRespostaApi(false, "Apenas usuários administradores podem cadastrar usuários.", null, 403);
        }

        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const email = validarStringComConteudo(body.email) ? body.email.trim().toLowerCase() : "";
        const senha = validarStringComConteudo(body.senha) ? body.senha : "";
        const confirmarSenha = validarStringComConteudo(body.confirmarSenha) ? body.confirmarSenha : "";
        const telefone = normalizarCampoOpcional(body.telefone);
        const documento = normalizarCampoOpcional(body.documento);
        const perfilId = normalizarPerfilId(body.perfilId);

        if (!nome || !validarEmail(email) || senha.length < 6) {
            return criarRespostaApi(false, "Informe nome, e-mail válido e senha com pelo menos 6 caracteres.", null, 400);
        }

        if (perfilId !== null && (!Number.isInteger(perfilId) || perfilId <= 0)) {
            return criarRespostaApi(false, "Informe um perfil válido para o usuário.", null, 400);
        }

        if (senha !== confirmarSenha) {
            return criarRespostaApi(false, "As senhas informadas não conferem.", null, 400);
        }

        const senhaCriptografada = criarHash(senha);

        const resultadoUsuario = await consultarBancoDados<{ id: number }>(
            `
                insert into usuarios (
                    nome,
                    email,
                    senha_hash,
                    salt,
                    telefone,
                    documento,
                    perfil_id,
                    empresa_padrao
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8)
                returning id
            `,
            [
                nome,
                email,
                senhaCriptografada.hash,
                senhaCriptografada.salt,
                telefone,
                documento,
                perfilId,
                empresaNavegacaoId,
            ]
        );

        await consultarBancoDados(
            `
                insert into usuarios_empresas (
                    usuario_id,
                    empresa_id,
                    criado_por
                )
                values ($1, $2, $3)
                on conflict (usuario_id, empresa_id) do nothing
            `,
            [resultadoUsuario.rows[0].id, empresaNavegacaoId, idUsuarioCriador]
        );

        return criarRespostaApi(true, "Usuário cadastrado com sucesso.", null, 201);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe um usuário cadastrado com este e-mail.", null, 409);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23503") {
            return criarRespostaApi(false, "O perfil informado não foi encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível cadastrar o usuário.", null, 500);
    }
}

/**
 * Endpoint PUT de usuários.
 * Atualiza dados cadastrais, perfil, status e senha opcional sem retornar informações sensíveis.
 */
export async function PUT(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "usuario",
            acao: "atualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const body = await request.json() as AtualizacaoUsuarioBody;
        const idUsuarioAtualizacao = obterIdUsuarioAutenticado(request);

        if (!idUsuarioAtualizacao) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const usuarioAdministrador = await verificarUsuarioAdministrador(idUsuarioAtualizacao);

        if (!usuarioAdministrador) {
            return criarRespostaApi(false, "Apenas usuários administradores podem atualizar usuários.", null, 403);
        }

        const id = typeof body.id === "number" ? body.id : Number(body.id);
        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const email = validarStringComConteudo(body.email) ? body.email.trim().toLowerCase() : "";
        const senha = validarStringComConteudo(body.senha) ? body.senha : "";
        const confirmarSenha = validarStringComConteudo(body.confirmarSenha) ? body.confirmarSenha : "";
        const telefone = normalizarCampoOpcional(body.telefone);
        const documento = normalizarCampoOpcional(body.documento);
        const perfilId = normalizarPerfilId(body.perfilId);
        const ativo = typeof body.ativo === "boolean" ? body.ativo : null;
        const isAdmin = typeof body.isAdmin === "boolean" ? body.isAdmin : null;

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe um usuário válido para atualização.", null, 400);
        }

        if (!nome || nome.length > 120 || !validarEmail(email) || email.length > 180) {
            return criarRespostaApi(false, "Informe nome e e-mail válido dentro do limite permitido.", null, 400);
        }

        if ((telefone && telefone.length > 20) || (documento && documento.length > 20)) {
            return criarRespostaApi(false, "Telefone e documento devem respeitar o limite de caracteres.", null, 400);
        }

        if (perfilId !== null && (!Number.isInteger(perfilId) || perfilId <= 0)) {
            return criarRespostaApi(false, "Informe um perfil válido para o usuário.", null, 400);
        }

        if (senha && senha.length < 6) {
            return criarRespostaApi(false, "A senha deve ter pelo menos 6 caracteres.", null, 400);
        }

        if (senha && senha !== confirmarSenha) {
            return criarRespostaApi(false, "As senhas informadas não conferem.", null, 400);
        }

        const senhaCriptografada = senha ? criarHash(senha) : null;

        const resultado = await consultarBancoDados<UsuarioListado>(
            `
                update usuarios
                set
                    nome = $1,
                    email = $2,
                    telefone = $3,
                    documento = $4,
                    perfil_id = $5,
                    ativo = coalesce($6, ativo),
                    "isAdmin" = coalesce($7, "isAdmin"),
                    senha_hash = coalesce($8, senha_hash),
                    salt = coalesce($9, salt),
                    atualizado_em = now()
                where id = $10
                returning id
            `,
            [
                nome,
                email,
                telefone,
                documento,
                perfilId,
                ativo,
                isAdmin,
                senhaCriptografada?.hash ?? null,
                senhaCriptografada?.salt ?? null,
                id,
            ]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Usuário atualizado com sucesso.", null);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe um usuário cadastrado com este e-mail.", null, 409);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23503") {
            return criarRespostaApi(false, "O perfil informado não foi encontrado.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível atualizar o usuário.", null, 500);
    }
}

/**
 * Endpoint DELETE de usuários.
 * Remove o usuário pelo id informado na query string sem retornar dados sensíveis.
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

        const idUsuarioExclusao = obterIdUsuarioAutenticado(request);

        if (!idUsuarioExclusao) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const usuarioAdministrador = await verificarUsuarioAdministrador(idUsuarioExclusao);

        if (!usuarioAdministrador) {
            return criarRespostaApi(false, "Apenas usuários administradores podem excluir usuários.", null, 403);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe um usuário válido para exclusão.", null, 400);
        }

        const resultado = await consultarBancoDados<UsuarioListado>(
            `
                delete from usuarios
                where id = $1
                returning id
            `,
            [id]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Usuário excluído com sucesso.", null);
    } catch (erro) {
        if (erro instanceof Error && "code" in erro && erro.code === "23503") {
            return criarRespostaApi(false, "Não é possível excluir este usuário porque ele possui vínculos.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível excluir o usuário.", null, 500);
    }
}
