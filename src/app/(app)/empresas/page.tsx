"use client";

import { Botao } from "@/components/inputs/button";
import ModalResposta from "@/components/modals/responseModal";
import { ColunaTabelaDados, TabelaDados } from "@/components/tables/dataTable";
import { requisitarAPI } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import { FaBuilding, FaPlus } from "react-icons/fa";
import ModalCadastroEmpresa from "./components/modalCadastroEmpresa";

type EmpresaTabela = {
    [key: string]: unknown;
    id: number;
    fantasia: string;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    ativo: boolean;
    criado_em: string;
    atualizado_em: string;
};

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
 * Use para consultar empresas cadastradas e abrir o formulário local de criação, edição e vínculos.
 */
export default function PaginaEmpresas() {
    const [empresas, setEmpresas] = useState<EmpresaTabela[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
    const [idEmpresaSelecionada, setIdEmpresaSelecionada] = useState<number | null>(null);

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
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar as empresas.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarEmpresasCadastradas();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarEmpresasCadastradas]);

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

    return (
        <div className="w-full">
            <div className="mb-6">
                <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <FaBuilding />
                            </span>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Empresas</h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    Consulte empresas cadastradas e gerencie seus vínculos com usuários.
                                </p>
                            </div>
                        </div>

                        <hr className="my-4 border-slate-200" />

                        <div className="grid gap-4 md:grid-cols-12 md:items-center">
                            <div className="md:col-span-8 lg:col-span-10">
                                <p className="mb-0 text-slate-500">
                                    Clique em uma empresa para visualizar, editar ou excluir o cadastro.
                                </p>
                            </div>
                            <div className="md:col-span-4 lg:col-span-2">
                                <Botao
                                    size="sm"
                                    label="Nova empresa"
                                    icon={<FaPlus size={14} />}
                                    onClick={() => {
                                        setIdEmpresaSelecionada(null);
                                        setModalCadastroAberto(true);
                                    }}
                                    disabled={carregando}
                                    loading={false}
                                    variant="outline-primary"
                                    type="button"
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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

            <ModalCadastroEmpresa
                aberto={modalCadastroAberto}
                idEmpresa={idEmpresaSelecionada}
                aoFechar={() => {
                    setModalCadastroAberto(false);
                    setIdEmpresaSelecionada(null);
                    void carregarEmpresasCadastradas();
                }}
            />

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </div>
    );
}
