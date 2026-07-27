export const STATUS_INICIAL_TICKET = "pendente_vinculo_agente";

export type TicketParaValidarVisualizacao = {
    responsavel_id: number;
    agente_id: number | null;
    status: string;
};

export type ContextoVisualizacaoTicket = {
    suporte_visualiza_apenas_tickets_proprios: boolean;
    cliente_visualiza_apenas_tickets_proprios: boolean;
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

    //se usuario for responsavel pelo ticket
    if (isResponsavel) {
        return true;
    }

    //se o usuario for admin
    if (isAdmin) {

        return true;
    }

    //se usuario for agente de suporte
    if (usuarioAgenteSuporte) {
        const agenteId = parseInt(ticket.agente_id?.toString() || "0");

        return contexto.suporte_visualiza_apenas_tickets_proprios == false
            || agenteId === idUsuario
            || ticket.status === STATUS_INICIAL_TICKET;
    }

    //se regra da empresa permitir que clientes visualizem tickets de outros clientes
    if (contexto.cliente_visualiza_apenas_tickets_proprios == false) {
        return true;
    }

    //se usuario for cliente manager
    if (usuarioClienteManager) {
        return true;
    }

    return false;
}
