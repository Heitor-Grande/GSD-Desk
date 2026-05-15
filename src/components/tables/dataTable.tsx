"use client";

import { Botao } from "@/components/inputs/button";
import { ReactNode, useMemo, useState } from "react";
import { FaFileExcel, FaSearch } from "react-icons/fa";
import * as XLSX from "xlsx";

const QUANTIDADE_REGISTROS_POR_PAGINA = 15;

/**
 * Configuracao de uma coluna da tabela reutilizavel.
 * Use `renderizar` quando o valor precisar de formatacao visual customizada.
 */
export type ColunaTabelaDados<T> = {
    chave: keyof T | string;
    titulo: string;
    alinhamento?: "start" | "center" | "end";
    renderizar?: (item: T) => ReactNode;
};

/**
 * Props da tabela generica de dados.
 * Use `placeholderFiltro` para customizar o texto do campo de busca.
 * Use `usaClickLinha` e `aoClicarLinha` quando a tela precisar receber o id do registro selecionado.
 * Use `usaExcel` para exibir o botao de exportacao dos dados filtrados em .xlsx.
 */
interface TabelaDadosProps<T> {
    colunas: ColunaTabelaDados<T>[];
    dados: T[];
    carregando: boolean;
    mensagemSemDados: string;
    placeholderFiltro: string;
    usaClickLinha?: boolean;
    aoClicarLinha?: (id: string | number | null) => void;
    usaExcel?: boolean;
    nomeArquivoExcel?: string;
}

/**
 * Tabela reutilizavel para listagens de cadastros.
 * Use em telas internas sempre que precisar listar registros com colunas configuraveis.
 */
export function TabelaDados<T extends Record<string, unknown>>({
    colunas,
    dados,
    carregando,
    mensagemSemDados,
    placeholderFiltro,
    usaClickLinha = false,
    aoClicarLinha,
    usaExcel = false,
    nomeArquivoExcel = "dados",
}: TabelaDadosProps<T>) {
    const [textoFiltro, setTextoFiltro] = useState("");
    const [paginaAtual, setPaginaAtual] = useState(1);

    /**
     * Filtra os registros em memoria usando os valores brutos das colunas configuradas.
     * Use para buscas simples sem nova chamada ao back.
     */
    const dadosFiltrados = useMemo(() => {
        const filtroNormalizado = textoFiltro.trim().toLowerCase();

        if (!filtroNormalizado) {
            return dados;
        }

        return dados.filter((item) => colunas.some((coluna) => {
            const valor = item[coluna.chave as keyof T];

            return String(valor ?? "").toLowerCase().includes(filtroNormalizado);
        }));
    }, [colunas, dados, textoFiltro]);

    const totalPaginas = Math.max(1, Math.ceil(dadosFiltrados.length / QUANTIDADE_REGISTROS_POR_PAGINA));
    const paginaAtualLimitada = Math.min(paginaAtual, totalPaginas);
    const indiceInicialPagina = (paginaAtualLimitada - 1) * QUANTIDADE_REGISTROS_POR_PAGINA;

    const dadosPaginados = useMemo(() => {
        return dadosFiltrados.slice(
            indiceInicialPagina,
            indiceInicialPagina + QUANTIDADE_REGISTROS_POR_PAGINA
        );
    }, [dadosFiltrados, indiceInicialPagina]);

    /**
     * Retorna o conteudo que sera exibido na celula.
     * Prioriza renderizacao customizada quando a coluna fornece `renderizar`.
     */
    function obterValorCelula(item: T, coluna: ColunaTabelaDados<T>): ReactNode {
        if (coluna.renderizar) {
            return coluna.renderizar(item);
        }

        const valor = item[coluna.chave as keyof T];
        return valor as ReactNode;
    }

    /**
     * Retorna o id bruto do item quando existir.
     * Use para callbacks de seleção sem expor o objeto inteiro da linha.
     */
    function obterIdLinha(item: T): string | number | null {
        const id = item.id;

        return typeof id === "string" || typeof id === "number" ? parseInt(String(id)) : null;
    }

    function atualizarTextoFiltro(valor: string) {
        setTextoFiltro(valor);
        setPaginaAtual(1);
    }

    function irParaPaginaAnterior() {
        setPaginaAtual((pagina) => Math.max(1, pagina - 1));
    }

    function irParaProximaPagina() {
        setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1));
    }

    function obterClasseAlinhamento(alinhamento: ColunaTabelaDados<T>["alinhamento"]) {
        const classes = {
            start: "text-left",
            center: "text-center",
            end: "text-right",
        };

        return classes[alinhamento || "start"];
    }

    /**
     * Exporta todos os dados filtrados da tabela para um arquivo Excel.
     * Use apenas valores brutos das colunas para manter a planilha simples e reaproveitavel.
     */
    function exportarDadosExcel() {
        const linhasExcel = dadosFiltrados.map((item) => {
            return colunas.reduce<Record<string, unknown>>((linha, coluna) => {
                const valor = item[coluna.chave as keyof T];

                linha[coluna.titulo] = valor ?? "";
                return linha;
            }, {});
        });

        const planilha = XLSX.utils.json_to_sheet(linhasExcel);
        const arquivo = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(arquivo, planilha, "Dados");
        XLSX.writeFile(arquivo, `${nomeArquivoExcel}.xlsx`);
    }

    return (
        <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex w-full max-w-md overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
                    <span className="inline-flex items-center justify-center border-r border-slate-200 bg-slate-50 px-3 text-slate-500">
                        <FaSearch />
                    </span>
                    <input
                        type="search"
                        className="min-h-10 w-full border-0 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                        placeholder={placeholderFiltro}
                        value={textoFiltro}
                        onChange={(event) => atualizarTextoFiltro(event.target.value)}
                        disabled={carregando || dados.length === 0}
                    />
                </div>

                {usaExcel && (
                    <Botao
                        size="sm"
                        icon={<FaFileExcel />}
                        onClick={exportarDadosExcel}
                        disabled={carregando || dadosFiltrados.length === 0}
                        loading={false}
                        variant="outline-success"
                        type="button"
                        className="min-h-10"
                        ariaLabel="Exportar dados para Excel"
                    />
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-sm">
                    <thead>
                        <tr>
                            {colunas.map((coluna) => (
                                <th
                                    key={String(coluna.chave)}
                                    className={`${obterClasseAlinhamento(coluna.alinhamento)} whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-700`}
                                >
                                    {coluna.titulo}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {carregando && (
                            <tr>
                                <td colSpan={colunas.length} className="px-4 py-12 text-center text-slate-600">
                                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 align-[-2px]" />
                                    Carregando registros...
                                </td>
                            </tr>
                        )}

                        {!carregando && dados.length === 0 && (
                            <tr>
                                <td colSpan={colunas.length} className="px-4 py-12 text-center text-slate-500">
                                    {mensagemSemDados}
                                </td>
                            </tr>
                        )}

                        {!carregando && dados.length > 0 && dadosFiltrados.length === 0 && (
                            <tr>
                                <td colSpan={colunas.length} className="px-4 py-12 text-center text-slate-500">
                                    Nenhum registro encontrado para o filtro informado.
                                </td>
                            </tr>
                        )}

                        {!carregando && dadosPaginados.map((item, indice) => {
                            const linhaClicavel = usaClickLinha && Boolean(aoClicarLinha);
                            const indiceRegistro = indiceInicialPagina + indice;

                            return (
                                <tr
                                    key={String(item.id || indiceRegistro)}
                                    className={linhaClicavel ? "cursor-pointer transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500" : "hover:bg-slate-50"}
                                    onClick={linhaClicavel ? () => aoClicarLinha?.(obterIdLinha(item)) : undefined}
                                    tabIndex={linhaClicavel ? 0 : undefined}
                                    role={linhaClicavel ? "button" : undefined}
                                    onKeyDown={linhaClicavel
                                        ? (event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                aoClicarLinha?.(obterIdLinha(item));
                                            }
                                        }
                                        : undefined}
                                >
                                {colunas.map((coluna) => (
                                    <td
                                        key={`${String(item.id || indiceRegistro)}-${String(coluna.chave)}`}
                                        className={`${obterClasseAlinhamento(coluna.alinhamento)} whitespace-nowrap border-b border-slate-100 px-4 py-3 text-slate-800`}
                                    >
                                        {obterValorCelula(item, coluna)}
                                    </td>
                                ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {!carregando && dadosFiltrados.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        Página {paginaAtualLimitada} de {totalPaginas}
                    </span>

                    <div className="grid grid-cols-2 gap-2 sm:inline-flex">
                        <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={irParaPaginaAnterior}
                            disabled={paginaAtualLimitada === 1}
                        >
                            Anterior
                        </button>
                        <button
                            type="button"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={irParaProximaPagina}
                            disabled={paginaAtualLimitada === totalPaginas}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
