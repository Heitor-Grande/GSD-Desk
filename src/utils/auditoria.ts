import { consultarBancoDados } from "@/services/database";

export type AcaoAuditoria = "CREATE" | "UPDATE" | "DELETE";

type DadosAuditoria = unknown;

type RegistrarAuditoriaParams = {
    acao: AcaoAuditoria;
    usuarioId: number;
    empresaId?: number | null;
    metodo?: string | null;
    rota?: string | null;
    dadosAntes?: DadosAuditoria;
    dadosDepois?: DadosAuditoria;
};

function validarIdPositivo(valor: number | null | undefined): boolean {
    return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

function normalizarDadosAuditoria(dados: DadosAuditoria | undefined): string | null {
    return dados ? JSON.stringify(dados) : null;
}

function normalizarTextoOpcional(valor: string | null | undefined): string | null {
    if (typeof valor !== "string") {
        return null;
    }

    const valorNormalizado = valor.trim();

    return valorNormalizado ? valorNormalizado : null;
}

/**
 * Registra uma ação relevante na tabela de auditoria.
 * Use após validar autenticação e regras da rota, preferencialmente dentro da mesma transação da operação auditada quando necessário.
 */
async function registrarAuditoria({
    acao,
    usuarioId,
    empresaId = null,
    metodo = null,
    rota = null,
    dadosAntes = null,
    dadosDepois = null,
}: RegistrarAuditoriaParams): Promise<void> {
    if (!validarIdPositivo(usuarioId)) {
        throw new Error("Informe um usuário válido para registrar a auditoria.");
    }

    if (empresaId !== null && !validarIdPositivo(empresaId)) {
        throw new Error("Informe uma empresa válida para registrar a auditoria.");
    }

    await consultarBancoDados(
        `
            insert into auditoria (
                acao,
                usuario_id,
                empresa_id,
                metodo_http,
                rota,
                dados_antes,
                dados_depois
            )
            values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        `,
        [
            acao,
            usuarioId,
            empresaId,
            normalizarTextoOpcional(metodo),
            normalizarTextoOpcional(rota),
            normalizarDadosAuditoria(dadosAntes),
            normalizarDadosAuditoria(dadosDepois),
        ]
    );
}

/**
 * Registra auditoria sem interromper o fluxo principal quando o log falhar.
 */
export async function registrarAuditoriaSegura(params: RegistrarAuditoriaParams): Promise<void> {
    try {
        await registrarAuditoria(params);
    } catch (erro) {
        console.error("Não foi possível registrar auditoria.", erro);
    }
}
