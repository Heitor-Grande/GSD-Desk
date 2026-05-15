import { randomBytes, scryptSync } from "crypto";

/**
 * Cria um hash seguro para valores sensíveis.
 * Use quando o salt precisa ser armazenado em coluna separada para validação futura.
 */
export function criarHash(valor: string): { hash: string; salt: string } {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(valor, salt, 64).toString("hex");

    return {
        hash: hash,
        salt: salt,
    };
}

/**
 * Valida se um valor em texto puro corresponde ao hash salvo com o salt informado.
 * Use em fluxos de login sem expor a senha ou o hash para o front.
 */
export function validarHash(valor: string, hashSalvo: string, salt: string): boolean {
    const hash = scryptSync(valor, salt, 64).toString("hex");

    return hash === hashSalvo;
}
