import { Pool, QueryResult, QueryResultRow } from "pg";

const conexaoBancoDados = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === "true" ? true : false,
});

/**
 * Executa queries no PostgreSQL usando a conexao configurada no .env.
 * Use nas rotas e services passando parametros no array para evitar SQL injection.
 */
export async function consultarBancoDados<T extends QueryResultRow = QueryResultRow>(
    query: string,
    parametros: unknown[] = []
): Promise<QueryResult<T>> {
    return conexaoBancoDados.query<T>(query, parametros);
}
