import { NextRequest } from "next/server";
import { criarRespostaApi } from "@/utils/respostaApi";

type ConfiguracaoRateLimit = {
    request: NextRequest;
    identificador: string;
    limite: number;
    janelaMs: number;
    mensagem?: string;
};

type RegistroRateLimit = {
    total: number;
    expiraEm: number;
};

const tentativasPorIp = new Map<string, RegistroRateLimit>();

/**
 * Extrai o IP mais provável da requisição.
 * Use em rotas de API para montar chaves simples de rate limit por cliente.
 */
export function obterIpRequisicao(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");

    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || "ip-desconhecido";
    }

    return realIp?.trim() || "ip-desconhecido";
}

/**
 * Verifica limite de tentativas por IP em memória.
 * Retorna null quando a requisição está liberada ou uma resposta 429 quando o limite foi excedido.
 */
export function verificarRateLimitPorIp({
    request,
    identificador,
    limite,
    janelaMs,
    mensagem = "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
}: ConfiguracaoRateLimit): ReturnType<typeof criarRespostaApi<null>> | null {
    const agora = Date.now();
    const ip = obterIpRequisicao(request);
    const chave = `${identificador}:${ip}`;
    const registroAtual = tentativasPorIp.get(chave);

    if (!registroAtual || registroAtual.expiraEm <= agora) {
        tentativasPorIp.set(chave, {
            total: 1,
            expiraEm: agora + janelaMs,
        });

        return null;
    }

    if (registroAtual.total >= limite) {
        return criarRespostaApi(false, mensagem, null, 429);
    }

    tentativasPorIp.set(chave, {
        total: registroAtual.total + 1,
        expiraEm: registroAtual.expiraEm,
    });

    return null;
}
