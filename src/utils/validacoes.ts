/**
 * Confirma se um valor desconhecido é uma string com conteúdo.
 * Use para campos obrigatorios recebidos de formularios, APIs ou JSON externo antes de chamar trim(), toLowerCase() ou salvar no banco.
 * Não use para campos opcionais quando string vazia deve virar null; nesse caso, use normalizarCampoOpcional.
 */
export function validarStringComConteudo(valor: unknown): valor is string {
    return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Valida o formato basico de um e-mail.
 * Use depois de confirmar que o valor e string, em fluxos de cadastro, login e recuperacao de senha.
 * Não use como única validação de existência de usuário; ela valida apenas formato.
 */
export function validarEmail(valor: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

/**
 * Normaliza campos opcionais para salvar no banco.
 * Use quando o campo pode ficar vazio, como telefone, documento, complemento ou observacao.
 * Retorna a string sem espaços quando preenchida, ou null quando estiver vazia ou vier em tipo inválido.
 */
export function normalizarCampoOpcional(valor: unknown): string | null {
    return validarStringComConteudo(valor) ? valor.trim() : null;
}
