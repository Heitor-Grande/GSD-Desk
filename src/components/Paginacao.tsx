"use client";

import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export type PaginacaoProps = {
    paginaAtual: number;
    totalPaginas: number;
    aoVoltar: () => void;
    aoAvancar: () => void;
    className?: string;
};

/**
 * Exibe controles simples para navegar entre páginas de uma listagem local.
 */
export default function Paginacao({
    paginaAtual,
    totalPaginas,
    aoVoltar,
    aoAvancar,
    className = "",
}: PaginacaoProps) {
  

    const estaNaPrimeiraPagina = paginaAtual <= 1;
    const estaNaUltimaPagina = paginaAtual >= totalPaginas;

    return (
        <div className={`flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
            <span className="text-sm font-medium text-slate-600">
                Página {paginaAtual} de {totalPaginas}
            </span>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={aoVoltar}
                    disabled={estaNaPrimeiraPagina}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-slate-300"
                >
                    <FaChevronLeft className="text-xs" />
                    Anterior
                </button>

                <button
                    type="button"
                    onClick={aoAvancar}
                    disabled={estaNaUltimaPagina}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-slate-300"
                >
                    Próxima
                    <FaChevronRight className="text-xs" />
                </button>
            </div>
        </div>
    );
}
