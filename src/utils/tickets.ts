export const STATUS_INICIAL_TICKET = "pendente_vinculo_agente";

export type TicketParaValidarVisualizacao = {
    responsavel_id: number;
    agente_id: number | null;
    status: string;
};

export type ContextoVisualizacaoTicket = {
    suporte_visualiza_apenas_tickets_proprios: boolean;
    perfil_nome: string | null;
};

export function normalizarNomePerfil(nome: string | null): string {
    return (nome || "").trim().toLowerCase();
}

/**
 * Verifica se o usuário autenticado pode visualizar um ticket conforme perfil,
 * responsabilidade, agente vinculado e regra da empresa.
 */
export function usuarioPodeVisualizarTicket({
    ticket,
    idUsuario,
    contexto,
}: {
    ticket: TicketParaValidarVisualizacao;
    idUsuario: number;
    contexto: ContextoVisualizacaoTicket;
}): boolean {
    const perfilNormalizado = normalizarNomePerfil(contexto.perfil_nome);
    const usuarioAgenteSuporte = perfilNormalizado === "agente de suporte";
    const usuarioClienteManager = perfilNormalizado === "cliente manager";
    const isResponsavel = parseInt(ticket.responsavel_id.toString()) === idUsuario;
    const isAdmin = perfilNormalizado === "admin";

    if (isResponsavel) {
        return true;
    }

    if (isAdmin) {

        return true;
    }

    if (usuarioAgenteSuporte) {
        const agenteId = parseInt(ticket.agente_id?.toString() || "0");

        return contexto.suporte_visualiza_apenas_tickets_proprios == false
            || agenteId === idUsuario
            || ticket.status === STATUS_INICIAL_TICKET;
    }

    if (usuarioClienteManager) {
        return true;
    }

    return false;
}
