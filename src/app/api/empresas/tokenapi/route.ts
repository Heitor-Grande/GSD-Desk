import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { gerarTokenAPI } from "@/utils/tokenApi";
import { NextRequest } from "next/server";

//rota para gerar token de acesso para a empresa usar a API gsd desk
export async function GET(request: NextRequest) {

    try {

        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "atualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const dadosParaTokenAPI = {
            id_empresa: Number(request.nextUrl.searchParams.get("id_empresa")),
            id_usuario: idUsuario
        };

        const resposta = await gerarTokenAPI(dadosParaTokenAPI);

        if (resposta === "Empresa não encontrada" || resposta === "Usuário não encontrado ou não pertence a empresa" || resposta === "Usuário não está ativo" || resposta === "Empresa não está ativa") {

            return criarRespostaApi(true, resposta, resposta, 404);
        }

        if (resposta === "Erro inesperado ao gerar token para API, consulte o suporte." || resposta === "Segredo da API não definido.") {

            return criarRespostaApi(false, resposta, null, 500);
        }

        return criarRespostaApi(true, "Token gerado com sucesso.", resposta, 200);
    } catch (error) {

        console.error("Erro ao processar a solicitação:", error);
        return criarRespostaApi(false, "Erro ao processar a solicitação.", null, 500);
    }
}
