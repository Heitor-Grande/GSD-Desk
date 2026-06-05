"use client";

import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { BarChart } from "@mui/x-charts/BarChart";
import { useCallback, useEffect, useState } from "react";

type StatusTicketDashboard = {
    status: string;
    quantidade: number;
    cor: string;
};

type StatusTicketDashboardApi = {
    status: string;
    quantidade: number;
};

const CHAVE_EMPRESA_NAVEGACAO = "empresaNavegacaoId";

const configuracoesStatusTickets = [
    { status: "pendente_vinculo_agente", rotulo: "Pendente vínculo agente", cor: "#dc3545" },
    { status: "com_agente", rotulo: "Com agente", cor: "#fd7e14" },
    { status: "com_cliente", rotulo: "Com cliente", cor: "#ffc107" },
    { status: "encerrado_resolvido", rotulo: "Resolvido", cor: "#198754" },
    { status: "encerrado_nao_resolvido", rotulo: "Não resolvido", cor: "#dc3545" },
];

function criarStatusTicketsZerados(): StatusTicketDashboard[] {
    return configuracoesStatusTickets.map((configuracao) => ({
        status: configuracao.rotulo,
        quantidade: 0,
        cor: configuracao.cor,
    }));
}

function validarStatusTicketDashboardApi(valor: unknown): valor is StatusTicketDashboardApi[] {
    return Array.isArray(valor)
        && valor.every((item) => (
            typeof item === "object"
            && item !== null
            && "status" in item
            && typeof item.status === "string"
            && "quantidade" in item
            && typeof item.quantidade === "number"
        ));
}

/**
 * Página principal do dashboard.
 * Use como ponto de entrada para indicadores da operação autenticada.
 */
export default function PaginaMenuPrincipal() {
    const [statusTickets, setStatusTickets] = useState<StatusTicketDashboard[]>(criarStatusTicketsZerados);
    const [carregandoStatusTickets, setCarregandoStatusTickets] = useState(true);
    const [mensagemResposta, setMensagemResposta] = useState("");

    const carregarStatusTickets = useCallback(async () => {
        setCarregandoStatusTickets(true);
        setMensagemResposta("");

        try {
            const empresaNavegacaoId = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);

            if (!empresaNavegacaoId) {
                setStatusTickets(criarStatusTicketsZerados());
                throw new Error("Selecione uma empresa de navegação.");
            }

            const resposta = await requisitarAPI(`/api/dashboard/status-tickets?empresaNavegacaoId=${empresaNavegacaoId}`, {
                method: "GET",
            });

            if (!validarStatusTicketDashboardApi(resposta.dados)) {
                throw new Error("Não foi possível interpretar os status dos tickets.");
            }

            const quantidadePorStatus = new Map(
                resposta.dados.map((item) => [item.status, item.quantidade])
            );
            const statusAtualizados = configuracoesStatusTickets.map((configuracao) => ({
                status: configuracao.rotulo,
                quantidade: quantidadePorStatus.get(configuracao.status) ?? 0,
                cor: configuracao.cor,
            }));

            setStatusTickets(statusAtualizados);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os status dos tickets.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregandoStatusTickets(false);
        }
    }, []);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarStatusTickets();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarStatusTickets]);

    return (
        <div className="w-full">
            <div className="mb-6 rounded-lg border border-[#dce3ec] bg-white p-6">
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="mb-0 mt-2 text-slate-500">
                    Acompanhe os principais indicadores dos tickets da empresa de navegação.
                </p>
            </div>

            <div className="grid max-w-xl gap-6 xl:grid-cols-1">
                <div className="overflow-hidden rounded-lg border border-[#dce3ec] bg-white shadow-sm">
                    <div className="p-0">
                        <div className="border-b border-[#dce3ec] px-4 py-3">
                            <h2 className="mb-0 text-base font-bold text-[#172033]">
                                Tickets por status
                            </h2>
                            <p className="mb-0 mt-1 text-sm text-[#6c757d]">
                                {carregandoStatusTickets ? "Carregando status dos tickets..." : "Visão quantitativa dos status atuais."}
                            </p>
                        </div>

                        <div className="flex h-80 items-center justify-center px-2 py-3 sm:px-3">
                            <div className="h-full w-full max-w-lg">
                                <BarChart
                                    xAxis={[
                                        {
                                            id: "statusTickets",
                                            scaleType: "band",
                                            data: statusTickets.map((statusTicket) => statusTicket.status),
                                            height: 84,
                                            tickLabelInterval: () => true,
                                            tickLabelStyle: {
                                                angle: -25,
                                                textAnchor: "end",
                                                fontSize: 11,
                                            },
                                            colorMap: {
                                                type: "ordinal",
                                                values: statusTickets.map((statusTicket) => statusTicket.status),
                                                colors: statusTickets.map((statusTicket) => statusTicket.cor),
                                            },
                                        },
                                    ]}
                                    yAxis={[
                                        {
                                            label: "Quantidade",
                                        },
                                    ]}
                                    series={[
                                        {
                                            data: statusTickets.map((statusTicket) => statusTicket.quantidade),
                                            label: "Tickets",
                                        },
                                    ]}
                                    margin={{
                                        left: 0,
                                        right: 10,
                                        top: 10,
                                        bottom: 10,
                                    }}
                                    sx={{
                                        "& .MuiBarElement-root": {
                                            cursor: "pointer",
                                        },
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </div>
    );
}
