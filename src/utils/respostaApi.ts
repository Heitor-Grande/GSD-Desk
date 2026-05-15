import { NextResponse } from "next/server";

export type RespostaApi<TipoDados> = {
    sucesso: boolean;
    msg: string;
    dados: TipoDados | null;
};

/**
 * Cria uma resposta JSON padronizada para rotas de API.
 * Use para manter o contrato { sucesso, msg, dados } em todos os endpoints.
 */
export function criarRespostaApi<TipoDados>(
    sucesso: boolean,
    msg: string,
    dados: TipoDados | null,
    status = 200
) {
    return NextResponse.json(
        {
            sucesso: sucesso,
            msg: msg,
            dados: dados,
        } satisfies RespostaApi<TipoDados>,
        { status: status }
    );
}
