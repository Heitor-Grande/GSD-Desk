"use client";

import { Botao } from "@/components/inputs/button";
import ModalResposta from "@/components/modals/responseModal";
import { ColunaTabelaDados, TabelaDados } from "@/components/tables/dataTable";
import { requisitarAPI } from "@/utils/api";
import { useCallback, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import ModalCadastroTicket from "./components/modalCadastroTicket";
import ModalDetalheTicket from "./components/modalDetalheTicket";

type TicketTabela = {
    id: number;
    titulo: string;
    empresa_nome: string;
    produto_nome: string;
    responsavel_nome: string;
    agente_nome: string | null;
    status: string;
    prioridade: string;
    criado_em: string;
    ultima_atualizacao_em: string;
};

const CHAVE_EMPRESA_NAVEGACAO = "empresaNavegacaoId";

const rotulosStatus: Record<string, string> = {
    pendente_vinculo_agente: "Pendente vínculo agente",
    com_agente: "Com agente",
    com_cliente: "Com cliente",
    encerrado_resolvido: "Encerrado resolvido",
    encerrado_nao_resolvido: "Encerrado não resolvido",
};

const classesStatus: Record<string, string> = {
    pendente_vinculo_agente: "border-[#dc3545]/30 bg-[#dc3545]/10 text-[#dc3545]",
    com_agente: "border-[#fd7e14]/30 bg-[#fd7e14]/10 text-[#fd7e14]",
    com_cliente: "border-[#ffc107]/40 bg-[#ffc107]/15 text-[#8a6500]",
    encerrado_resolvido: "border-[#198754]/30 bg-[#198754]/10 text-[#198754]",
    encerrado_nao_resolvido: "border-[#dc3545]/30 bg-[#dc3545]/10 text-[#dc3545]",
};

const rotulosPrioridade: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    muito_alta: "Muito alta",
};

function formatarDataHora(valor: string): string {
    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(data);
}

/**
 * Página inicial do menu Tickets.
 * Use como ponto de entrada para a gestão de tickets da área autenticada.
 */
export default function PaginaTickets() {
    const [tickets, setTickets] = useState<TicketTabela[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
    const [idTicketSelecionado, setIdTicketSelecionado] = useState<number | null>(null);

    const colunas: ColunaTabelaDados<TicketTabela>[] = [
        { chave: "titulo", titulo: "Título" },
        { chave: "empresa_nome", titulo: "Empresa" },
        { chave: "produto_nome", titulo: "Produto" },
        { chave: "responsavel_nome", titulo: "Responsável" },
        {
            chave: "agente_nome",
            titulo: "Agente",
            renderizar: (ticket) => ticket.agente_nome || "-",
        },
        {
            chave: "status",
            titulo: "Status",
            renderizar: (ticket) => (
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classesStatus[ticket.status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                    {rotulosStatus[ticket.status] || ticket.status}
                </span>
            ),
        },
        {
            chave: "prioridade",
            titulo: "Prioridade",
            renderizar: (ticket) => rotulosPrioridade[ticket.prioridade] || ticket.prioridade,
        },
        {
            chave: "criado_em",
            titulo: "Criado em",
            renderizar: (ticket) => formatarDataHora(ticket.criado_em),
        },
    ];

    /**
     * Carrega tickets da empresa de navegação selecionada.
     */
    const carregarTickets = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const empresaNavegacaoId = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);

            if (!empresaNavegacaoId) {
                setTickets([]);
                setMensagemResposta("Selecione uma empresa de navegação.");
                return;
            }

            const resposta = await requisitarAPI(`/api/tickets?empresaNavegacaoId=${empresaNavegacaoId}`, {
                method: "GET",
            });

            setTickets(Array.isArray(resposta.dados) ? resposta.dados as TicketTabela[] : []);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os tickets.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarTickets();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarTickets]);

    function abrirTicketSelecionado(idTicket: string | number | null) {
        const idNormalizado = Number(idTicket);

        if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) {
            setMensagemResposta("Não foi possível identificar o ticket selecionado.");
            return;
        }

        setIdTicketSelecionado(idNormalizado);
    }

    return (
        <div className="w-full">
            <div className="mb-6 rounded-lg border border-[#dce3ec] bg-white p-6">
                <div className="grid gap-4 md:grid-cols-12 md:items-center">
                    <div className="md:col-span-8 lg:col-span-10">
                        <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
                        <p className="mb-0 mt-2 text-slate-500">
                            Área inicial para acompanhamento e cadastro de tickets.
                        </p>
                    </div>

                    <div className="md:col-span-4 lg:col-span-2">
                        <Botao
                            size="sm"
                            label="Novo Ticket"
                            icon={<FaPlus size={14} />}
                            onClick={() => setModalCadastroAberto(true)}
                            disabled={carregando}
                            loading={carregando}
                            variant="outline-primary"
                            type="button"
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <TabelaDados
                colunas={colunas}
                dados={tickets}
                carregando={carregando}
                mensagemSemDados="Nenhum ticket cadastrado."
                placeholderFiltro="Procurar por ticket"
                usaExcel={true}
                nomeArquivoExcel="tickets"
                usaClickLinha={true}
                aoClicarLinha={abrirTicketSelecionado}
            />

            {modalCadastroAberto && (
                <ModalCadastroTicket
                    aberto={modalCadastroAberto}
                    aoFechar={() => {
                        setModalCadastroAberto(false);
                        void carregarTickets();
                    }}
                />
            )}

            {idTicketSelecionado && (
                <ModalDetalheTicket
                    aberto={Boolean(idTicketSelecionado)}
                    idTicket={idTicketSelecionado}
                    aoFechar={() => {
                        setIdTicketSelecionado(null);
                        void carregarTickets();
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
