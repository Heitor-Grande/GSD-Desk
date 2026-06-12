"use client";

import { Botao } from "@/components/inputs/button";
import ModalResposta from "@/components/modals/responseModal";
import { ColunaTabelaDados, TabelaDados } from "@/components/tables/dataTable";
import { requisitarAPI } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import { FaList, FaPlus, FaSitemap } from "react-icons/fa";
import ModalCadastroEmpresa from "./components/modalCadastroEmpresa";

type EmpresaTabela = {
    [key: string]: unknown;
    id: number;
    fantasia: string;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    ativo: boolean;
    superior_id: number | null;
    superior_fantasia: string | null;
    exigir_vinculo_produto: boolean;
    suporte_visualiza_apenas_tickets_proprios: boolean;
    criado_em: string;
    atualizado_em: string;
};

type EmpresaArvoreNode = {
    id: number;
    fantasia: string;
    superior_id: number | null;
    children: EmpresaArvoreNode[];
};

type AbaEmpresas = "lista" | "arvore";

function formatarCnpj(valor: string): string {
    const digitos = valor.replace(/\D/g, "").slice(0, 14);

    return digitos
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Página de listagem de empresas.
 * Use como referência para telas de cadastro que precisam consumir API e renderizar a TabelaDados.
 */
export default function PaginaEmpresas() {
    const [empresas, setEmpresas] = useState<EmpresaTabela[]>([]);
    const [arvoreEmpresas, setArvoreEmpresas] = useState<EmpresaArvoreNode[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [carregandoArvore, setCarregandoArvore] = useState(false);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
    const [idEmpresaSelecionada, setIdEmpresaSelecionada] = useState<number | null>(null);
    const [abaAtiva, setAbaAtiva] = useState<AbaEmpresas>("lista");

    const colunas: ColunaTabelaDados<EmpresaTabela>[] = [
        { chave: "fantasia", titulo: "Nome" },
        {
            chave: "cnpj",
            titulo: "CNPJ",
            renderizar: (empresa) => formatarCnpj(empresa.cnpj),
        },
        {
            chave: "email",
            titulo: "E-mail",
            renderizar: (empresa) => empresa.email || "-",
        },
        {
            chave: "telefone",
            titulo: "Telefone",
            renderizar: (empresa) => empresa.telefone || "-",
        },
        {
            chave: "superior_fantasia",
            titulo: "Superior",
            renderizar: (empresa) => empresa.superior_fantasia || "-",
        },
        {
            chave: "ativo",
            titulo: "Status",
            renderizar: (empresa) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${empresa.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {empresa.ativo ? "Ativa" : "Inativa"}
                </span>
            ),
        },
    ];

    /**
     * Carrega as empresas cadastradas na API.
     * Use ao abrir a tela e sempre que a listagem precisar ser atualizada.
     */
    const carregarEmpresasCadastradas = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/empresas", {
                method: "GET",
            });

            setEmpresas(Array.isArray(resposta.dados) ? resposta.dados as EmpresaTabela[] : []);
            setMensagemResposta("");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar as empresas.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    const carregarArvoreEmpresas = useCallback(async () => {
        setCarregandoArvore(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/empresas?arvore=true", {
                method: "GET",
            });

            setArvoreEmpresas(Array.isArray(resposta.dados) ? resposta.dados as EmpresaArvoreNode[] : []);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar a árvore de empresas.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregandoArvore(false);
        }
    }, []);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarEmpresasCadastradas();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarEmpresasCadastradas]);

    useEffect(() => {
        if (abaAtiva !== "arvore" || arvoreEmpresas.length > 0 || carregandoArvore) {
            return;
        }

        const carregamentoArvore = window.setTimeout(() => {
            void carregarArvoreEmpresas();
        }, 0);

        return () => window.clearTimeout(carregamentoArvore);
    }, [abaAtiva, arvoreEmpresas.length, carregandoArvore, carregarArvoreEmpresas]);

    /**
     * Abre o modal com os dados da empresa selecionada na tabela.
     */
    function abrirCadastroEmpresaSelecionada(idEmpresa: string | number | null) {
        const idNormalizado = Number(idEmpresa);

        if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) {
            setMensagemResposta("Não foi possível identificar a empresa selecionada.");
            return;
        }

        setIdEmpresaSelecionada(idNormalizado);
        setModalCadastroAberto(true);
    }

    function obterClassesAba(aba: AbaEmpresas): string {
        const classesBase = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition";

        return abaAtiva === aba
            ? `${classesBase} border-blue-600 bg-blue-600 text-white shadow-sm`
            : `${classesBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
    }

    function renderizarNoArvore(empresa: EmpresaArvoreNode, nivel = 0, caminho: number[] = []) {
        const possuiCiclo = caminho.includes(empresa.id);
        const filhos = possuiCiclo ? [] : empresa.children;

        return (
            <div key={`${empresa.id}-${nivel}`} className="border-l border-slate-200 pl-4">
                <div
                    className="flex min-h-11 items-center gap-3 border-b border-slate-100 py-2"
                    style={{ marginLeft: `${nivel * 16}px` }}
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                        {filhos.length}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{empresa.fantasia}</p>
                        <p className="text-xs text-slate-500">ID {empresa.id}</p>
                    </div>
                </div>

                {filhos.map((filho) => renderizarNoArvore(filho, nivel + 1, [...caminho, empresa.id]))}
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <h5 className="text-lg font-bold text-slate-900">Empresas</h5>
                        <hr className="my-4 border-slate-200" />

                        <div className="w-full">
                            <div className="grid gap-4 md:grid-cols-12 md:items-center">
                                <div className="md:col-span-8 lg:col-span-10">
                                    <p className="mb-0 text-slate-500">
                                        Consulte as empresas cadastradas na aplicação.
                                    </p>
                                </div>
                                <div className="md:col-span-3 lg:col-span-2">
                                    <Botao
                                        size="sm"
                                        label="Empresa"
                                        icon={<FaPlus size={14} />}
                                        onClick={() => {
                                            setIdEmpresaSelecionada(null);
                                            setModalCadastroAberto(true);
                                        }}
                                        disabled={carregando}
                                        loading={carregando}
                                        variant="outline-primary"
                                        type="button"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    className={obterClassesAba("lista")}
                    onClick={() => setAbaAtiva("lista")}
                >
                    <FaList aria-hidden="true" />
                    Lista
                </button>
                <button
                    type="button"
                    className={obterClassesAba("arvore")}
                    onClick={() => setAbaAtiva("arvore")}
                >
                    <FaSitemap aria-hidden="true" />
                    Árvore
                </button>
            </div>

            {abaAtiva === "lista" && (
                <TabelaDados
                    colunas={colunas}
                    dados={empresas}
                    carregando={carregando}
                    mensagemSemDados="Nenhuma empresa cadastrada."
                    placeholderFiltro="Procurar por empresa"
                    usaExcel={true}
                    usaClickLinha={true}
                    aoClicarLinha={abrirCadastroEmpresaSelecionada}
                    nomeArquivoExcel="empresas"
                />
            )}

            {abaAtiva === "arvore" && (
                <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="border-b border-slate-200 bg-white p-4">
                        <h6 className="text-sm font-bold text-slate-900">Hierarquia de empresas</h6>
                    </div>

                    <div className="p-4">
                        {carregandoArvore && (
                            <div className="py-10 text-center text-sm text-slate-600">
                                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 align-[-2px]" />
                                Carregando árvore de empresas...
                            </div>
                        )}

                        {!carregandoArvore && arvoreEmpresas.length === 0 && (
                            <div className="py-10 text-center text-sm text-slate-500">
                                Nenhuma empresa encontrada para montar a árvore.
                            </div>
                        )}

                        {!carregandoArvore && arvoreEmpresas.length > 0 && (
                            <div className="space-y-2">
                                {arvoreEmpresas.map((empresa) => renderizarNoArvore(empresa))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {modalCadastroAberto && (
                <ModalCadastroEmpresa
                    aberto={modalCadastroAberto}
                    idEmpresa={idEmpresaSelecionada}
                    aoFechar={() => {
                        setModalCadastroAberto(false);
                        setIdEmpresaSelecionada(null);
                        void carregarEmpresasCadastradas();
                        void carregarArvoreEmpresas();
                    }}
                />
            )}

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </div>
    );
}
