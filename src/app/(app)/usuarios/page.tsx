"use client";

import { Botao } from "@/components/inputs/button";
import ModalResposta from "@/components/modals/responseModal";
import { ColunaTabelaDados, TabelaDados } from "@/components/tables/dataTable";
import { requisitarAPI } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import ModalCadastroUsuario from "./components/modalCadastroUsuario";

type UsuarioTabela = {
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    documento: string | null;
    perfil_nome: string | null;
    ativo: boolean;
    criado_em: string;
};

/**
 * Página de listagem de usuários.
 * Use como referência para telas de cadastro que precisam consumir API e renderizar a TabelaDados.
 */
export default function PaginaUsuarios() {
    const [usuarios, setUsuarios] = useState<UsuarioTabela[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
    const [idUsuarioSelecionado, setIdUsuarioSelecionado] = useState<number | null>(null);

    const colunas: ColunaTabelaDados<UsuarioTabela>[] = [
        { chave: "nome", titulo: "Nome" },
        { chave: "email", titulo: "E-mail" },
        {
            chave: "telefone",
            titulo: "Telefone",
            renderizar: (usuario) => usuario.telefone || "-",
        },
        {
            chave: "documento",
            titulo: "Documento",
            renderizar: (usuario) => usuario.documento || "-",
        },
        {
            chave: "perfil_nome",
            titulo: "Perfil",
            renderizar: (usuario) => usuario.perfil_nome || "-",
        },
        {
            chave: "ativo",
            titulo: "Status",
            renderizar: (usuario) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${usuario.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {usuario.ativo ? "Ativo" : "Inativo"}
                </span>
            ),
        },
    ];

    /**
     * Carrega os usuários cadastrados na API.
     * Use ao abrir a tela e sempre que a listagem precisar ser atualizada.
     */
    const carregarUsuariosCadastrados = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/usuarios", {
                method: "GET",
            });

            setUsuarios(Array.isArray(resposta.dados) ? resposta.dados : []);
            setMensagemResposta("");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os usuários.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarUsuariosCadastrados();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarUsuariosCadastrados]);

    /**
     * Abre o modal com os dados do usuário selecionado na tabela.
     */
    function abrirCadastroUsuarioSelecionado(idUsuario: string | number | null) {
        const idNormalizado = Number(idUsuario);

        if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) {
            setMensagemResposta("Não foi possível identificar o usuário selecionado.");
            return;
        }

        setIdUsuarioSelecionado(idNormalizado);
        setModalCadastroAberto(true);
    }

    return (
        <div className="w-full">
            <div className="mb-6">
                <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <h5 className="text-lg font-bold text-slate-900">Usuários</h5>
                        <hr className="my-4 border-slate-200" />

                        <div className="w-full">
                            <div className="grid gap-4 md:grid-cols-12 md:items-center">
                                <div className="md:col-span-8 lg:col-span-10">
                                    <p className="mb-0 text-slate-500">
                                        Consulte os usuários cadastrados na aplicação.
                                    </p>
                                </div>
                                <div className="md:col-span-4 lg:col-span-2">
                                    <Botao
                                        size="sm"
                                        label="Novo usuário"
                                        icon={<FaPlus size={14} />}
                                        onClick={() => {
                                            setIdUsuarioSelecionado(null);
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

            <TabelaDados
                colunas={colunas}
                dados={usuarios}
                carregando={carregando}
                mensagemSemDados="Nenhum usuário cadastrado."
                placeholderFiltro="Procurar por usuário"
                usaExcel={true}
                usaClickLinha={true}
                aoClicarLinha={abrirCadastroUsuarioSelecionado}
            />

            <ModalCadastroUsuario
                aberto={modalCadastroAberto}
                idUsuario={idUsuarioSelecionado}
                aoFechar={() => {
                    setModalCadastroAberto(false);
                    setIdUsuarioSelecionado(null);
                    carregarUsuariosCadastrados();
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
