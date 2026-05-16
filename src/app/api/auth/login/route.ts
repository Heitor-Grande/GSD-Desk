import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { validarHash } from "@/utils/criptografia";
import { criarJWT } from "@/utils/jwt";
import { verificarRateLimitPorIp } from "@/utils/rateLimit";
import { criarRespostaApi } from "@/utils/respostaApi";
import { validarEmail, validarStringComConteudo } from "@/utils/validacoes";

const MAX_AGE_COOKIE_PADRAO_SEGUNDOS = 60 * 60 * 24 * 7;

type LoginBody = {
    email?: string;
    password?: string;
};

type UsuarioLogin = {
    id: string;
    email: string;
    senha_hash: string;
    salt: string;
    perfil_id: number | null;
    perfil_ativo: boolean | null;
    empresa_padrao: number | null;
    ativo: boolean;
};

/**
 * Retorna a validade do cookie de sessão em segundos.
 * Use a variável MAXAGE_COOKIE para manter o cookie alinhado com a validade do JWT.
 */
function obterMaxAgeCookieSessao(): number {
    const maxAgeCookie = Number(process.env.MAXAGE_COOKIE);

    return Number.isFinite(maxAgeCookie) && maxAgeCookie > 0 ? maxAgeCookie : MAX_AGE_COOKIE_PADRAO_SEGUNDOS;
}

/**
 * Resposta padronizada para falhas de autenticação.
 * Use mensagem genérica para não revelar se o e-mail existe ou qual campo falhou.
 */
function criarRespostaCredenciaisInvalidas(mensagem: string) {
    return criarRespostaApi(false, mensagem, null, 401);
}

/**
 * Endpoint POST de login.
 * Valida entrada, autentica pelo banco e grava a sessão em cookie httpOnly sem retornar token ao front.
 */
export async function POST(request: NextRequest) {
    try {
        const respostaRateLimit = verificarRateLimitPorIp({
            request: request,
            identificador: "login",
            limite: 5,
            janelaMs: 15 * 60 * 1000,
        });

        if (respostaRateLimit) {
            return respostaRateLimit;
        }

        const body = await request.json() as LoginBody;
        const email = validarStringComConteudo(body.email) ? body.email.trim().toLowerCase() : "";
        const password = validarStringComConteudo(body.password) ? body.password : "";

        if (!validarEmail(email) || !password) {
            return criarRespostaCredenciaisInvalidas("E-mail ou senha inválidos.");
        }

        const resultadoUsuario = await consultarBancoDados<UsuarioLogin>(
            `
                select
                    id,
                    email,
                    senha_hash,
                    salt,
                    perfil_id,
                    perfil_ativo,
                    empresa_padrao,
                    ativo
                from (
                    select
                        u.id,
                        u.email,
                        u.senha_hash,
                        u.salt,
                        u.perfil_id,
                        p.ativo as perfil_ativo,
                        u.empresa_padrao,
                        u.ativo
                    from usuarios u
                    left join perfil p on p.id = u.perfil_id
                    where lower(u.email) = $1
                    limit 1
                ) usuario
            `,
            [email]
        );

        const usuario = resultadoUsuario.rows[0];

        if (!usuario) {
            return criarRespostaCredenciaisInvalidas("E-mail ou senha inválidos.");
        }

        if (!usuario.ativo) {
            return criarRespostaApi(false, "Usuário inativo. Entre em contato com o suporte.", null, 403);
        }

        if (!usuario.perfil_id) {
            return criarRespostaApi(false, "Usuário não possuí perfil de permissão vinculado.", null, 403);
        }

        if (usuario.perfil_ativo === null) {
            return criarRespostaApi(false, "O perfil vinculado ao usuário não existe.", null, 403);
        }

        if (!usuario.perfil_ativo) {
            return criarRespostaApi(false, "O perfil vinculado ao usuário está Inativo.", null, 403);
        }

        if (!validarHash(password, usuario.senha_hash, usuario.salt)) {
            return criarRespostaCredenciaisInvalidas("E-mail ou senha inválidos.");
        }

        if (!usuario.empresa_padrao) {
            return criarRespostaApi(false, "Usuário não possui vínculo com empresas ou não possui uma empresa padrão.", null, 403);
        }

        const resposta = criarRespostaApi(true, "Login realizado com sucesso.", null);

        resposta.cookies.set("app_session", criarJWT(usuario.id, usuario.ativo), {
            httpOnly: true,
            secure: process.env.AMBIENTE === "PROD",
            sameSite: "lax",
            path: "/",
            maxAge: obterMaxAgeCookieSessao(),
        });

        return resposta;
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }
      
        return criarRespostaApi(false, "Não foi possível realizar o login.", null, 500);
    }
}
