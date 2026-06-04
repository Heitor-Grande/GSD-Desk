import { consultarBancoDados } from "@/services/database";

export type AcaoAuditoria = "CREATE" | "UPDATE" | "DELETE";

type DadosAuditoria = Record<string, unknown> | null;

type RegistrarAuditoriaParams = {
    acao: AcaoAuditoria;
    usuarioId: number;
    empresaId?: number | null;
    dadosAntes?: DadosAuditoria;
    dadosDepois?: DadosAuditoria;
};

function validarIdPositivo(valor: number | null | undefined): boolean {
    return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

function normalizarDadosAuditoria(dados: DadosAuditoria | undefined): string | null {
    return dados ? JSON.stringify(dados) : null;
}

/**
 * Registra uma ação relevante na tabela de auditoria.
 * Use após validar autenticação e regras da rota, preferencialmente dentro da mesma transação da operação auditada quando necessário.
 */
export async function registrarAuditoria({
    acao,
    usuarioId,
    empresaId = null,
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
                dados_antes,
                dados_depois
            )
            values ($1, $2, $3, $4::jsonb, $5::jsonb)
        `,
        [
            acao,
            usuarioId,
            empresaId,
            normalizarDadosAuditoria(dadosAntes),
            normalizarDadosAuditoria(dadosDepois),
        ]
    );
}
