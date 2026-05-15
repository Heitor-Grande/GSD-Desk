import { NextRequest } from "next/server";
import { obterPayloadJWT } from "@/utils/jwt";

const NOME_COOKIE_SESSAO = "app_session";

/**
 * Obtém o id do usuário autenticado a partir do JWT salvo no cookie de sessão.
 * Use em rotas de API quando a operação precisar identificar o usuário logado.
 */
export function obterIdUsuarioAutenticado(request: NextRequest): number | null {
    const token = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
    const payload = token ? obterPayloadJWT(token) : null;
    const idUsuario = payload ? Number(payload.idUsuario) : 0;

    return Number.isInteger(idUsuario) && idUsuario > 0 ? idUsuario : null;
}
