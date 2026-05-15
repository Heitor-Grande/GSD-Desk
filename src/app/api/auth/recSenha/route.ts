import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { enviarEmail } from "@/services/email";
import { criarHash } from "@/utils/criptografia";
import { criarJWTRecuperacaoSenha, obterPayloadRecuperacaoSenhaJWT } from "@/utils/jwt";
import { verificarRateLimitPorIp } from "@/utils/rateLimit";
import { criarRespostaApi } from "@/utils/respostaApi";
import { validarEmail, validarStringComConteudo } from "@/utils/validacoes";

type RecuperacaoSenhaBody = {
    email?: string;
};

type ValidacaoCodigoBody = {
    codigo?: string;
    token?: string;
};

type AlteracaoSenhaBody = ValidacaoCodigoBody & {
    senha?: string;
    confirmarSenha?: string;
};

type DadosRecuperacaoSenha = {
    token: string;
};

type UsuarioRecuperacaoSenha = {
    id: string;
    email: string;
    ativo: boolean;
};

/**
 * Gera um código numérico de cinco dígitos para validação de recuperação de senha.
 * Use no fluxo de recuperação antes da redefinição definitiva da senha.
 */
function gerarCodigoRecuperacaoSenha(): string {
    return String(Math.floor(10000 + Math.random() * 90000));
}

/**
 * Confirma se o código informado possui exatamente cinco dígitos.
 * Use antes de comparar com o código salvo no token temporário.
 */
function validarFormatoCodigoRecuperacao(codigo: string): boolean {
    return /^\d{5}$/.test(codigo);
}

/**
 * Monta o HTML do e-mail de recuperação de senha.
 * Use para manter a comunicação visual alinhada à paleta padrão da aplicação.
 */
function montarHtmlRecuperacaoSenha(codigo: string): string {
    return `
        <div style="margin:0;padding:32px;background-color:#f4f7fb;font-family:Arial,sans-serif;color:#273142;">
            <div style="max-width:520px;margin:0 auto;background-color:#ffffff;border:1px solid #dce3ec;border-radius:8px;overflow:hidden;">
                <div style="padding:24px;background-color:#111827;color:#e5edf8;">
                    <h1 style="margin:0;font-size:22px;line-height:1.3;">Recuperação de senha</h1>
                    <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">GSD Desk</p>
                </div>

                <div style="padding:28px 24px;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                        Recebemos uma solicitação para recuperar o acesso à sua conta.
                    </p>

                    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#6c757d;">
                        Informe o código abaixo na aplicação para continuar o processo.
                    </p>

                    <div style="margin:0 0 22px;padding:18px;border:1px solid #dce3ec;border-radius:8px;background-color:#f8fafc;text-align:center;">
                        <strong style="display:block;color:#0d6efd;font-size:32px;letter-spacing:8px;line-height:1;">
                            ${codigo}
                        </strong>
                    </div>

                    <p style="margin:0;color:#6c757d;font-size:13px;line-height:1.5;">
                        Se você não solicitou essa recuperação, ignore este e-mail.
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Busca o usuário de recuperação por e-mail e retorna mensagens específicas para e-mail inexistente ou inativo.
 */
async function obterUsuarioAtivoPorEmail(email: string): Promise<UsuarioRecuperacaoSenha | Response> {
    const resultadoUsuario = await consultarBancoDados<UsuarioRecuperacaoSenha>(
        `
            select
                id,
                email,
                ativo
            from usuarios
            where lower(email) = $1
            limit 1
        `,
        [email]
    );

    const usuario = resultadoUsuario.rows[0];

    if (!usuario) {
        return criarRespostaApi(false, "E-mail não está cadastrado.", null, 404);
    }

    if (!usuario.ativo) {
        return criarRespostaApi(false, "Usuário está inativo.", null, 403);
    }

    return usuario;
}

/**
 * Valida token temporário, código de recuperação e existência do usuário ativo.
 */
async function validarTokenCodigoRecuperacao(token: string, codigo: string): Promise<UsuarioRecuperacaoSenha | Response> {
    if (!token || !validarFormatoCodigoRecuperacao(codigo)) {
        return criarRespostaApi(false, "Informe o código de recuperação válido.", null, 400);
    }

    const payload = obterPayloadRecuperacaoSenhaJWT(token);

    if (!payload) {
        return criarRespostaApi(false, "Solicitação de recuperação expirada ou inválida.", null, 401);
    }

    if (payload.codigo !== codigo) {
        return criarRespostaApi(false, "O código informado não confere.", null, 400);
    }

    return obterUsuarioAtivoPorEmail(payload.email);
}

/**
 * Endpoint POST de recuperação de senha.
 * Valida o e-mail, envia um código por e-mail e retorna um JWT temporário com o código no payload.
 */
export async function POST(request: NextRequest) {
    try {
        const respostaRateLimit = verificarRateLimitPorIp({
            request: request,
            identificador: "recuperacao-senha-envio",
            limite: 3,
            janelaMs: 15 * 60 * 1000,
        });

        if (respostaRateLimit) {
            return respostaRateLimit;
        }

        const body = await request.json() as RecuperacaoSenhaBody;
        const email = validarStringComConteudo(body.email) ? body.email.trim().toLowerCase() : "";

        if (!validarEmail(email)) {
            return criarRespostaApi(false, "Informe um e-mail válido.", null, 400);
        }

        const usuario = await obterUsuarioAtivoPorEmail(email);

        if (usuario instanceof Response) {
            return usuario;
        }

        const codigo = gerarCodigoRecuperacaoSenha();
        const token = criarJWTRecuperacaoSenha(email, codigo);

        await enviarEmail({
            to: email,
            subject: "Recuperação de Senha",
            html: montarHtmlRecuperacaoSenha(codigo),
        });

        return criarRespostaApi<DadosRecuperacaoSenha>(
            true,
            "Código de recuperação enviado para o e-mail informado.",
            {
                token: token,
            }
        );
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível enviar o e-mail de recuperação.", null, 500);
    }
}

/**
 * Endpoint PUT de validação do código de recuperação.
 * Confirma se o código informado bate com o código salvo no JWT temporário.
 */
export async function PUT(request: NextRequest) {
    try {
        const respostaRateLimit = verificarRateLimitPorIp({
            request: request,
            identificador: "recuperacao-senha-codigo",
            limite: 5,
            janelaMs: 15 * 60 * 1000,
        });

        if (respostaRateLimit) {
            return respostaRateLimit;
        }

        const body = await request.json() as ValidacaoCodigoBody;
        const codigo = validarStringComConteudo(body.codigo) ? body.codigo.trim() : "";
        const token = validarStringComConteudo(body.token) ? body.token : "";

        const usuario = await validarTokenCodigoRecuperacao(token, codigo);

        if (usuario instanceof Response) {
            return usuario;
        }

        return criarRespostaApi(true, "Código validado com sucesso.", null);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível validar o código de recuperação.", null, 500);
    }
}

/**
 * Endpoint PATCH de alteração de senha por recuperação.
 * Atualiza a senha apenas quando token e código temporário forem válidos.
 */
export async function PATCH(request: NextRequest) {
    try {
        const respostaRateLimit = verificarRateLimitPorIp({
            request: request,
            identificador: "recuperacao-senha-alteracao",
            limite: 5,
            janelaMs: 15 * 60 * 1000,
        });

        if (respostaRateLimit) {
            return respostaRateLimit;
        }

        const body = await request.json() as AlteracaoSenhaBody;
        const codigo = validarStringComConteudo(body.codigo) ? body.codigo.trim() : "";
        const token = validarStringComConteudo(body.token) ? body.token : "";
        const senha = validarStringComConteudo(body.senha) ? body.senha : "";
        const confirmarSenha = validarStringComConteudo(body.confirmarSenha) ? body.confirmarSenha : "";

        const usuario = await validarTokenCodigoRecuperacao(token, codigo);

        if (usuario instanceof Response) {
            return usuario;
        }

        if (senha.length < 6) {
            return criarRespostaApi(false, "A senha deve ter pelo menos 6 caracteres.", null, 400);
        }

        if (senha !== confirmarSenha) {
            return criarRespostaApi(false, "As senhas informadas não conferem.", null, 400);
        }

        const senhaCriptografada = criarHash(senha);

        await consultarBancoDados(
            `
                update usuarios
                set
                    senha_hash = $1,
                    salt = $2,
                    atualizado_em = now()
                where id = $3
            `,
            [
                senhaCriptografada.hash,
                senhaCriptografada.salt,
                usuario.id,
            ]
        );

        return criarRespostaApi(true, "Senha alterada com sucesso.", null);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        return criarRespostaApi(false, "Não foi possível alterar a senha.", null, 500);
    }
}
