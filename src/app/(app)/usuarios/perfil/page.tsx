"use client";

import { Botao } from "@/components/inputs/button";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { ColunaTabelaDados, TabelaDados } from "@/components/tables/dataTable";
import { requisitarAPI } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import ModalCadastroPerfil, { DadosPerfil } from "./components/modalCadastroPerfil";

type PerfilTabela = DadosPerfil & {
    descricao: string;
    criado_em: string;
} & Record<string, unknown>;

/**
 * Conta quantas permissões estão habilitadas no perfil.
 * Use para exibir um resumo simples na listagem.
 */
function contarPermissoesAtivas(perfil: DadosPerfil): number {
    return Object.values(perfil.permissoes).reduce((total, permissoes) => {
        return total + Object.values(permissoes).filter(Boolean).length;
    }, 0);
}

/**
 * Página de listagem de perfis.
 * Use como referência para telas de cadastro que precisam consumir API e renderizar a TabelaDados.
 */
export default function PaginaPerfis() {
    const [perfis, setPerfis] = useState<PerfilTabela[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
    const [idPerfilSelecionado, setIdPerfilSelecionado] = useState<number | null>(null);

    const colunas: ColunaTabelaDados<PerfilTabela>[] = [
        { chave: "nome", titulo: "Perfil" },
        {
            chave: "descricao",
            titulo: "Descrição",
            renderizar: (perfil) => perfil.descricao || "-",
        },
        {
            chave: "permissoes",
            titulo: "Permissões",
            renderizar: (perfil) => `${contarPermissoesAtivas(perfil)} permissões ativas`,
        },
        {
            chave: "ativo",
            titulo: "Status",
            renderizar: (perfil) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${perfil.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {perfil.ativo ? "Ativo" : "Inativo"}
                </span>
            ),
        },
    ];

    /**
     * Carrega os perfis cadastrados na API.
     * Use ao abrir a tela e sempre que a listagem precisar ser atualizada.
     */
    const carregarPerfisCadastrados = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/perfil", {
                method: "GET",
            });

            setPerfis(Array.isArray(resposta.dados) ? resposta.dados as PerfilTabela[] : []);
            setMensagemResposta("");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os perfis.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarPerfisCadastrados();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarPerfisCadastrados]);

    function abrirCadastroNovoPerfil() {
        setIdPerfilSelecionado(null);
        setModalCadastroAberto(true);
    }

    /**
     * Abre o modal com os dados do perfil selecionado na tabela.
     */
    function abrirPerfilSelecionado(idPerfil: string | number | null) {
        const idNormalizado = Number(idPerfil);

        if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) {
            setMensagemResposta("Não foi possível identificar o perfil selecionado.");
            return;
        }

        setIdPerfilSelecionado(idNormalizado);
        setModalCadastroAberto(true);
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <h5 className="text-lg font-bold text-slate-900">Perfis</h5>
                        <hr className="my-4 border-slate-200" />

                        <div className="w-full">
                            <div className="grid gap-4 md:grid-cols-12 md:items-center">
                                <div className="md:col-span-8 lg:col-span-10">
                                    <p className="mb-0 text-slate-500">
                                        Consulte e organize os perfis de acesso da aplicação.
                                    </p>
                                </div>
                                <div className="md:col-span-4 lg:col-span-2">
                                    <Botao
                                        size="sm"
                                        label="Novo perfil"
                                        icon={<FaPlus size={14} />}
                                        onClick={abrirCadastroNovoPerfil}
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

            <TabelaDados
                colunas={colunas}
                dados={perfis}
                carregando={carregando}
                mensagemSemDados="Nenhum perfil cadastrado."
                placeholderFiltro="Procurar por perfil"
                usaExcel={true}
                usaClickLinha={true}
                aoClicarLinha={abrirPerfilSelecionado}
                nomeArquivoExcel="perfis"
            />

            <ModalCadastroPerfil
                aberto={modalCadastroAberto}
                idPerfil={idPerfilSelecionado}
                aoFechar={() => {
                    setModalCadastroAberto(false);
                    setIdPerfilSelecionado(null);
                    void carregarPerfisCadastrados();
                }}
            />

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />

            <ModalCarregamento
                show={carregando}
                text="Carregando perfis..."
            />
        </div>
    );
}
