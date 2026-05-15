import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { criarHash } from "@/utils/criptografia";
import { criarRespostaApi } from "@/utils/respostaApi";
import { normalizarCampoOpcional, validarEmail, validarStringComConteudo } from "@/utils/validacoes";

type UsuarioMinhaConta = {
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    documento: string | null;
    perfil_id: number | null;
    perfil_nome: string | null;
    ativo: boolean;
    isAdmin: boolean;
    criado_em: Date;
    atualizado_em: Date;
};

type AtualizacaoMinhaContaBody = {
    nome?: string;
    email?: string;
    senha?: string;
    confirmarSenha?: string;
    telefone?: string;
    documento?: string;
    ativo?: boolean;
};

/**
 * Endpoint GET de Minha conta.
 * Carrega as informações do usuário autenticado com base no id salvo no JWT.
 */
export async function GET(request: NextRequest) {
    try {
        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const resultado = await consultarBancoDados<UsuarioMinhaConta>(
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
                left join perfil p on p.id = u.perfil_id
                where u.id = $1
                limit 1
            `,
            [idUsuario]
        );

        const usuario = resultado.rows[0];

        if (!usuario) {
            return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Dados da conta carregados com sucesso.", usuario);
    } catch {
        return criarRespostaApi(false, "Não foi possível carregar os dados da conta.", null, 500);
    }
}

/**
 * Endpoint PUT de Minha conta.
 * Atualiza apenas os dados editáveis do usuário autenticado, sem alterar o perfil vinculado.
 */
export async function PUT(request: NextRequest) {
    try {
        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const body = await request.json() as AtualizacaoMinhaContaBody;

        const nome = validarStringComConteudo(body.nome) ? body.nome.trim() : "";
        const email = validarStringComConteudo(body.email) ? body.email.trim().toLowerCase() : "";
        const senha = validarStringComConteudo(body.senha) ? body.senha : "";
        const confirmarSenha = validarStringComConteudo(body.confirmarSenha) ? body.confirmarSenha : "";
        const telefone = normalizarCampoOpcional(body.telefone);
        const documento = normalizarCampoOpcional(body.documento);
        const ativo = typeof body.ativo === "boolean" ? body.ativo : null;

        if (!nome || nome.length > 120 || !validarEmail(email) || email.length > 180) {
            return criarRespostaApi(false, "Informe nome e e-mail válido dentro do limite permitido.", null, 400);
        }

        if ((telefone && telefone.length > 20) || (documento && documento.length > 20)) {
            return criarRespostaApi(false, "Telefone e documento devem respeitar o limite de caracteres.", null, 400);
        }

        if (senha && senha.length < 6) {
            return criarRespostaApi(false, "A senha deve ter pelo menos 6 caracteres.", null, 400);
        }

        if (senha && senha !== confirmarSenha) {
            return criarRespostaApi(false, "As senhas informadas não conferem.", null, 400);
        }

        const senhaCriptografada = senha ? criarHash(senha) : null;

        const resultado = await consultarBancoDados(
            `
                update usuarios
                set
                    nome = $1,
                    email = $2,
                    telefone = $3,
                    documento = $4,
                    ativo = coalesce($5, ativo),
                    senha_hash = coalesce($6, senha_hash),
                    salt = coalesce($7, salt),
                    atualizado_em = now()
                where id = $8
                returning id
            `,
            [
                nome,
                email,
                telefone,
                documento,
                ativo,
                senhaCriptografada?.hash ?? null,
                senhaCriptografada?.salt ?? null,
                idUsuario,
            ]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Usuário não encontrado.", null, 404);
        }

        return criarRespostaApi(true, "Dados da conta atualizados com sucesso.", null);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe um usuário cadastrado com este e-mail.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível atualizar os dados da conta.", null, 500);
    }
}
