import { criarRespostaApi } from "@/utils/respostaApi";

/**
 * Endpoint POST de logout.
 * Remove o cookie httpOnly de sessão para encerrar o acesso do usuário.
 */
export async function POST() {
    const resposta = criarRespostaApi(true, "Logout realizado com sucesso.", null);

    resposta.cookies.set("app_session", "", {
        httpOnly: true,
        secure: process.env.AMBIENTE === "PROD",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return resposta;
}
