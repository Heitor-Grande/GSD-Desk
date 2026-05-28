"use client";

import { Botao } from "@/components/inputs/button";
import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import ModalCadastroTicket from "./components/modalCadastroTicket";

/**
 * Página inicial do menu Tickets.
 * Use como ponto de entrada para a gestão de tickets da área autenticada.
 */
export default function PaginaTickets() {
    const [modalCadastroAberto, setModalCadastroAberto] = useState(false);

    return (
        <div className="w-full">
            <div className="rounded-lg border border-[#dce3ec] bg-white p-6">
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
                            disabled={false}
                            loading={false}
                            variant="outline-primary"
                            type="button"
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {modalCadastroAberto && (
                <ModalCadastroTicket
                    aberto={modalCadastroAberto}
                    aoFechar={() => setModalCadastroAberto(false)}
                />
            )}
        </div>
    );
}
