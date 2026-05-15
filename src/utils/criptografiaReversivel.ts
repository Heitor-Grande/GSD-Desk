import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITMO_CRIPTOGRAFIA = "aes-256-gcm";

/**
 * Criptografa valores que precisam ser recuperados em texto original posteriormente.
 * Use para configurações sensíveis editáveis, como credenciais SMTP.
 */
export function criptografarValor(valor: string): string {
    const iv = randomBytes(12);
    const chave = obterChaveCriptografia();
    const cipher = createCipheriv(ALGORITMO_CRIPTOGRAFIA, chave, iv);
    const valorCriptografado = Buffer.concat([
        cipher.update(valor, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        iv.toString("hex"),
        authTag.toString("hex"),
        valorCriptografado.toString("hex"),
    ].join(":");
}

/**
 * Descriptografa valores sensíveis salvos com criptografarValor.
 * Use apenas em fluxos server-side que precisam preencher formulários ou configurar integrações.
 */
export function descriptografarValor(valorCriptografado: string | null): string {
    if (!valorCriptografado) {
        return "";
    }

    const [ivHex, authTagHex, conteudoHex] = valorCriptografado.split(":");

    if (!ivHex || !authTagHex || !conteudoHex) {
        return "";
    }

    const chave = obterChaveCriptografia();
    const decipher = createDecipheriv(
        ALGORITMO_CRIPTOGRAFIA,
        chave,
        Buffer.from(ivHex, "hex")
    );

    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    return Buffer.concat([
        decipher.update(Buffer.from(conteudoHex, "hex")),
        decipher.final(),
    ]).toString("utf8");
}

function obterChaveCriptografia(): Buffer {
    const segredo = process.env.JWT_SECRET_REVERSIVEL;

    if (!segredo) {
        throw new Error("JWT_SECRET_REVERSIVEL não configurado.");
    }

    return createHash("sha256").update(segredo).digest();
}
