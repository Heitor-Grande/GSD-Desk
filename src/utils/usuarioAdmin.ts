import { consultarBancoDados } from "@/services/database";

type UsuarioAdminBanco = {
    isAdmin: boolean;
};

/**
 * Verifica se o usuário informado possui perfil administrativo.
 * Use em rotas de API quando a operação depender do campo "isAdmin" da tabela de usuários.
 */
export async function verificarUsuarioAdministrador(idUsuario: number | string | null | undefined): Promise<boolean> {
    const idUsuarioNormalizado = Number(idUsuario);

    if (!Number.isInteger(idUsuarioNormalizado) || idUsuarioNormalizado <= 0) {
        return false;
    }

    const resultado = await consultarBancoDados<UsuarioAdminBanco>(
        `
            select "isAdmin"
            from usuarios
            where id = $1
            limit 1
        `,
        [idUsuarioNormalizado]
    );

    return resultado.rows[0]?.isAdmin === true;
}
