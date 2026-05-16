import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";

type ParametrosVinculoEmpresaUsuario = {
    request: NextRequest;
    idEmpresa: number | string | null | undefined;
};

type VinculoEmpresaUsuario = {
    id: number;
};

/**
 * Verifica se a empresa informada está vinculada ao usuário autenticado.
 * Use em rotas de API para validar acesso por empresa antes de executar consultas ou alterações.
 * retorna true se o vínculo existir, ou false caso não exista.
 */
export async function verificarEmpresaPertenceAoUsuario({
    request,
    idEmpresa,
}: ParametrosVinculoEmpresaUsuario): Promise<boolean> {
    const idUsuario = obterIdUsuarioAutenticado(request);
    const idEmpresaNormalizado = Number(idEmpresa);

    if (!idUsuario || !Number.isInteger(idEmpresaNormalizado) || idEmpresaNormalizado <= 0) {
        return false;
    }

    const resultado = await consultarBancoDados<VinculoEmpresaUsuario>(
        `
            select id
            from usuarios_empresas
            where usuario_id = $1
                and empresa_id = $2
            limit 1
        `,
        [idUsuario, idEmpresaNormalizado]
    );

    return Boolean(resultado.rows[0]);
}
