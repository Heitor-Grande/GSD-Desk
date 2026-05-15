import { NextRequest, NextResponse } from "next/server";
import { obterPayloadJWT } from "@/utils/jwt";
import { criarRespostaApi } from "@/utils/respostaApi";

const NOME_COOKIE_SESSAO = "app_session";
const ROTAS_PUBLICAS = [
    "/", 
    "/api/auth/login", 
    "/api/auth/recSenha", 
    "/api/auth/recSenha/validarCodigo", 
    "/api/auth/recSenha/alterarSenha"
];

// Verifica se o caminho da requisição é uma rota pública.
function rotaPublica(caminho: string): boolean {
    return ROTAS_PUBLICAS.includes(caminho);
}

/**
 * Proxy global de autenticação.
 * Use para bloquear rotas protegidas quando o cookie de sessão não possuir JWT válido ou payload ativo.
 */
export function proxy(request: NextRequest) {
    const caminho = request.nextUrl.pathname;

    if (rotaPublica(caminho)) {
        return NextResponse.next();
    }

    const token = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
    const payload = token ? obterPayloadJWT(token) : null;

    if (payload?.ativo === true) {
        return NextResponse.next();
    }

    if (caminho.startsWith("/api")) {
        return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
    }

    return NextResponse.redirect(new URL("/", request.url));
}

// Não aplica o proxy para rotas públicas, arquivos estáticos e assets.
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
    ],
};
