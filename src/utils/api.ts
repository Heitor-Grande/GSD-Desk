type MetodoHttp = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type OpcoesRequisicao = {
    method?: MetodoHttp;
    body?: unknown;
};

export type RespostaApi<TipoDados> = {
    sucesso: boolean;
    msg: string;
    dados: TipoDados | null;
};

/**
 * Realiza requisições HTTP padronizadas para a aplicação.
 * Use para centralizar method, headers, body JSON e leitura da resposta.
 */
export async function requisitarAPI(
    rota: string,
    opcoes: OpcoesRequisicao = {}
): Promise<RespostaApi<unknown>> {
    const { method, body } = opcoes;

    if (!method) {
        throw new Error("Informe o method da requisição.");
    }

    const resposta = await fetch(rota, {
        method: method,
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const dados = await resposta.json() as RespostaApi<unknown>;

    if (!resposta.ok) {
        const mensagemErro = typeof dados === "object" && dados !== null && "msg" in dados && typeof dados.msg === "string"
            ? dados.msg
            : "Não foi possível concluir a requisição.";

        throw new Error(mensagemErro);
    }

    return dados;
}
