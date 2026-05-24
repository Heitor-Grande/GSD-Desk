export const quantidadePadraoRegistrosPorPagina = 5;

/**
 * Calcula o total de páginas para uma listagem local.
 */
export function calcularTotalPaginas(
    totalRegistros: number,
    quantidadePorPagina = quantidadePadraoRegistrosPorPagina
): number {
    return Math.max(1, Math.ceil(totalRegistros / quantidadePorPagina));
}

/**
 * Retorna apenas os registros da página atual.
 */
export function paginarLista<TipoItem>(
    lista: TipoItem[],
    paginaAtual: number,
    quantidadePorPagina = quantidadePadraoRegistrosPorPagina
): TipoItem[] {
    const indiceInicial = (paginaAtual - 1) * quantidadePorPagina;

    return lista.slice(indiceInicial, indiceInicial + quantidadePorPagina);
}
