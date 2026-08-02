import jwt from "jsonwebtoken";
import { consultarBancoDados } from "@/services/database";

const segredoAPI = process.env.JWT_SECRET_CONSULT_API || '';

interface dadosParaTokenAPI {

    id_empresa: number;
    id_usuario: number;
    versao_token?: string;
}

//função que vai gerar token para API do GSD DESK
export async function gerarTokenAPI(dados: dadosParaTokenAPI): Promise<string> {

    try {

        if (segredoAPI === '') {
            console.error("Segredo da API não definido.");
            return "Segredo da API não definido.";
        }

        //consulta a ultima versao do token gerado
        const versao_token = await consultarBancoDados("SELECT versao_token_api FROM public.empresas WHERE id = $1", [dados.id_empresa]);

        if (versao_token.rows.length === 0) {

            return "Empresa não encontrada";
        }

        //consulta se o usuario esta ativo e pertence a empresa
        const usuarioAtivo = await consultarBancoDados(`
            select 
            u.ativo as usuario_ativo,
            ue.empresa_id as id_empresa,
            e.ativo as emrpesa_ativo
            from usuarios u 
            left join usuarios_empresas ue on ue.usuario_id = u.id 
            left join empresas e on e.id = ue.empresa_id 
            where u.id = $1 and ue.empresa_id = $2
            `, [dados.id_usuario, dados.id_empresa]);

        if (usuarioAtivo.rows.length === 0) {

            return "Usuário não encontrado ou não pertence a empresa";
        }

        if (usuarioAtivo.rows[0].usuario_ativo == false) {

            return "Usuário não está ativo";
        }

        if (usuarioAtivo.rows[0].emrpesa_ativo == false) {

            return "Empresa não está ativa";
        }

        //gera o token para API
        const versaoToken = versao_token.rows[0].versao_token_api == null ? "vt1" : "vt" + (parseInt(versao_token.rows[0].versao_token_api.replace("vt", "")) + 1).toString();

        const payload: dadosParaTokenAPI = {
            id_empresa: dados.id_empresa,
            id_usuario: dados.id_usuario,
            versao_token: versaoToken
        }

        const tokenAPI = jwt.sign(payload, segredoAPI);

        //gravando nova vserão do token gerado no banco de dados
        await consultarBancoDados("UPDATE public.empresas SET versao_token_api = $1 WHERE id = $2", [versaoToken, dados.id_empresa]);

        return tokenAPI;
    } catch (error) {

        console.error("Erro ao gerar token para API:", error);
        return "Erro inesperado ao gerar token para API, consulte o suporte.";
    }
}

//função para verificar se o token da API é valido
export function verificarTokenAPI(token: string): { sucesso: boolean; payload: dadosParaTokenAPI | null; message: string } {
    try {
        if (segredoAPI === '') {

            console.error("Segredo da API não definido.");
            return {
                sucesso: false,
                payload: null,
                message: "Segredo da API não definido."
            };
        }

        jwt.verify(token, segredoAPI);

        return {
            sucesso: true,
            payload: jwt.decode(token) as dadosParaTokenAPI,
            message: "Token válido."
        };

    } catch (error) {

        console.error("Token de API inválido:", error);
        return {
            sucesso: false,
            payload: null,
            message: "Token de API inválido."
        }
    }
}