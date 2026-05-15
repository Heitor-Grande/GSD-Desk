import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";

type PayloadJWT = JwtPayload & {
    idUsuario: string;
    ativo: boolean;
    dataLogin: string;
};

type PayloadRecuperacaoSenhaJWT = JwtPayload & {
    email: string;
    codigo: string;
    dataSolicitacao: string;
};

/**
 * Cria um JWT com id do usuário e data de login.
 * Use para gerar o valor do cookie de sessão da aplicação.
 */
export function criarJWT(idUsuario: string, ativo: boolean): string {
    const segredo = obterSegredoJWT();
    const validade = (process.env.JWT_VALIDADE) as SignOptions["expiresIn"];

    return jwt.sign(
        {
            idUsuario: idUsuario,
            ativo: ativo,
            dataLogin: new Date().toISOString(),
        },
        segredo,
        {
            expiresIn: validade,
        }
    );
}

/**
 * Cria um JWT com o código de recuperação de senha.
 * Use para devolver ao front o token temporário que será validado nas próximas etapas do fluxo.
 */
export function criarJWTRecuperacaoSenha(email: string, codigo: string): string {
    const segredo = obterSegredoJWT();
    const validade = (process.env.JWT_REC_SENHA_VALIDADE ?? "15m") as SignOptions["expiresIn"];

    return jwt.sign(
        {
            email: email,
            codigo: codigo,
            dataSolicitacao: new Date().toISOString(),
        } satisfies PayloadRecuperacaoSenhaJWT,
        segredo,
        {
            expiresIn: validade,
        }
    );
}

/**
 * Retorna o payload do JWT temporário de recuperação quando assinatura e expiração são válidas.
 * Use nas etapas de validação do código e alteração de senha.
 */
export function obterPayloadRecuperacaoSenhaJWT(token: string): PayloadRecuperacaoSenhaJWT | null {
    try {
        const payload = jwt.verify(token, obterSegredoJWT()) as PayloadRecuperacaoSenhaJWT;

        if (
            typeof payload.email === "string"
            && typeof payload.codigo === "string"
            && typeof payload.dataSolicitacao === "string"
        ) {
            return payload;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Valida se o JWT informado possui assinatura correta e ainda não expirou.
 * Retorna true para tokens válidos e false para tokens inválidos ou expirados.
 */
export function validarJWT(token: string): boolean {
    return obterPayloadJWT(token) !== null;
}

/**
 * Retorna o payload do JWT quando assinatura e expiração são válidas.
 * Use em rotas protegidas que precisam identificar o usuário autenticado.
 */
export function obterPayloadJWT(token: string): PayloadJWT | null {
    try {
        const payload = jwt.verify(token, obterSegredoJWT()) as PayloadJWT;

        if (
            typeof payload.idUsuario === "string"
            && typeof payload.ativo === "boolean"
            && typeof payload.dataLogin === "string"
        ) {
            return payload;
        }

        return null;
    } catch {
        return null;
    }
}

function obterSegredoJWT(): string {
    const segredo = process.env.JWT_SECRET;

    if (!segredo) {
        throw new Error("JWT_SECRET não configurado.");
    }

    return segredo;
}
