import { NextRequest } from "next/server";
import { consultarBancoDados } from "@/services/database";
import { registrarAuditoriaSegura } from "@/utils/auditoria";
import { obterIdUsuarioAutenticado } from "@/utils/autenticacao";
import { verificarPermissaoAPI } from "@/utils/permissoes";
import { criarRespostaApi } from "@/utils/respostaApi";
import { normalizarCampoOpcional, validarEmail, validarStringComConteudo } from "@/utils/validacoes";

type EmpresaListada = {
    id: number;
    fantasia: string;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    ativo: boolean;
    superior_id: number | null;
    superior_fantasia?: string | null;
    exigir_vinculo_produto: boolean;
    suporte_visualiza_apenas_tickets_proprios: boolean;
    criado_em: Date;
    atualizado_em: Date;
};

type EmpresaArvoreBanco = {
    id: number;
    fantasia: string;
    superior_id: number | null;
};

type EmpresaArvoreNode = EmpresaArvoreBanco & {
    children: EmpresaArvoreNode[];
};

type CadastroEmpresaBody = {
    id?: unknown;
    fantasia?: unknown;
    cnpj?: unknown;
    email?: unknown;
    telefone?: unknown;
    ativo?: unknown;
    superiorId?: unknown;
    superior_id?: unknown;
    exigirVinculoProduto?: unknown;
    suporteVisualizaApenasTicketsProprios?: unknown;
};

function normalizarCnpj(valor: unknown): string {
    return validarStringComConteudo(valor) ? valor.replace(/\D/g, "") : "";
}

function montarArvoreEmpresas(empresas: EmpresaArvoreBanco[]): EmpresaArvoreNode[] {
    const mapaEmpresas = new Map<number, EmpresaArvoreNode>();

    empresas.forEach((empresa) => {
        mapaEmpresas.set(empresa.id, {
            ...empresa,
            children: [],
        });
    });

    function possuiCiclo(idEmpresa: number, idSuperior: number): boolean {
        const visitados = new Set<number>([idEmpresa]);
        let idAtual: number | null = idSuperior;

        while (idAtual) {
            if (visitados.has(idAtual)) {
                return true;
            }

            visitados.add(idAtual);
            idAtual = mapaEmpresas.get(idAtual)?.superior_id ?? null;
        }

        return false;
    }

    const raizes: EmpresaArvoreNode[] = [];

    mapaEmpresas.forEach((empresa) => {
        if (!empresa.superior_id) {
            raizes.push(empresa);
            return;
        }

        const superior = mapaEmpresas.get(empresa.superior_id);

        if (!superior || possuiCiclo(empresa.id, empresa.superior_id)) {
            raizes.push(empresa);
            return;
        }

        superior.children.push(empresa);
    });

    function ordenarNos(nos: EmpresaArvoreNode[]) {
        nos.sort((empresaA, empresaB) => empresaA.fantasia.localeCompare(empresaB.fantasia, "pt-BR"));
        nos.forEach((empresa) => ordenarNos(empresa.children));
    }

    ordenarNos(raizes);

    return raizes;
}

function normalizarIdOpcional(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === "") {
        return null;
    }

    const id = typeof valor === "number" ? valor : Number(valor);

    return Number.isInteger(id) && id > 0 ? id : null;
}

async function validarEmpresaSuperior({
    idSuperior,
    idUsuario,
    idEmpresaAtual,
}: {
    idSuperior: number | null;
    idUsuario: number;
    idEmpresaAtual?: number | null;
}): Promise<boolean> {
    if (!idSuperior) {
        return true;
    }

    if (idEmpresaAtual && idSuperior === idEmpresaAtual) {
        return false;
    }

    const resultado = await consultarBancoDados<{ id: number }>(
        `
            select e.id
            from empresas e
            inner join usuarios_empresas ue on ue.empresa_id = e.id
            where e.id = $1
                and ue.usuario_id = $2
                and e.ativo = true
            limit 1
        `,
        [idSuperior, idUsuario]
    );

    if (!resultado.rows[0]) {
        return false;
    }

    if (!idEmpresaAtual) {
        return true;
    }

    const resultadoCiclo = await consultarBancoDados<{ id: number }>(
        `
            with recursive descendentes as (
                select e.id
                from empresas e
                where e.superior_id = $1

                union

                select filha.id
                from empresas filha
                inner join descendentes d on d.id = filha.superior_id
            )
            select id
            from descendentes
            where id = $2
            limit 1
        `,
        [idEmpresaAtual, idSuperior]
    );

    return !resultadoCiclo.rows[0];
}

/**
 * Endpoint DELETE de empresas.
 * Remove os vínculos com usuários e exclui a empresa informada na query string.
 */
export async function DELETE(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "deletar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const id = Number(request.nextUrl.searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe uma empresa válida para exclusão.", null, 400);
        }

        const resultado = await consultarBancoDados<EmpresaListada>(
            `
                with vinculos_removidos as (
                    delete from usuarios_empresas
                    where empresa_id = $1
                )
                delete from empresas
                where id = $1
                returning id,
                    fantasia,
                    cnpj,
                    email,
                    telefone,
                    ativo,
                    superior_id,
                    exigir_vinculo_produto,
                    suporte_visualiza_apenas_tickets_proprios,
                    criado_em,
                    atualizado_em
            `,
            [id]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
        }

        try {
            await registrarAuditoriaSegura({
                acao: "DELETE",
                usuarioId: idUsuario,
                empresaId: id,
                metodo: request.method,
                rota: request.nextUrl.pathname,
                dadosAntes: resultado.rows[0],
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

        return criarRespostaApi(true, "Empresa excluída com sucesso.", null);
    } catch (erro) {
        if (erro instanceof Error && "code" in erro && erro.code === "23503") {
            return criarRespostaApi(false, "Não foi possível excluir a empresa porque ela possui registros vinculados.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível excluir a empresa.", null, 500);
    }
}

function obterBooleanoAtivo(valor: unknown): boolean {
    return typeof valor === "boolean" ? valor : true;
}

/**
 * Endpoint GET de empresas.
 * Use para listar empresas ou carregar uma empresa pelo id informado na query string.
 */
export async function GET(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "visualizar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const id = Number(request.nextUrl.searchParams.get("id"));
        const listarSuperiores = request.nextUrl.searchParams.get("superiores") === "true";
        const listarArvore = request.nextUrl.searchParams.get("arvore") === "true";
        const idEmpresaAtual = Number(request.nextUrl.searchParams.get("empresaAtualId"));

        if (Number.isInteger(id) && id > 0) {
            const resultadoEmpresa = await consultarBancoDados<EmpresaListada>(
                `
                    select
                        e.id,
                        e.fantasia,
                        e.cnpj,
                        e.email,
                        e.telefone,
                        e.ativo,
                        e.superior_id,
                        superior.fantasia as superior_fantasia,
                        e.exigir_vinculo_produto,
                        e.suporte_visualiza_apenas_tickets_proprios,
                        e.criado_em,
                        e.atualizado_em
                    from empresas e
                    left join empresas superior on superior.id = e.superior_id
                    where e.id = $1
                    limit 1
                `,
                [id]
            );

            const empresa = resultadoEmpresa.rows[0];

            if (!empresa) {
                return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
            }

            return criarRespostaApi(true, "Empresa carregada com sucesso.", empresa);
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        if (listarArvore) {
            const resultadoArvore = await consultarBancoDados<EmpresaArvoreBanco>(
                `
                    with recursive empresas_hierarquia as (
                        select
                            e.id,
                            e.fantasia,
                            e.superior_id,
                            array[e.id] as caminho
                        from empresas e
                        inner join usuarios_empresas ue on ue.empresa_id = e.id
                        where ue.usuario_id = $1

                        union

                        select
                            superior.id,
                            superior.fantasia,
                            superior.superior_id,
                            eh.caminho || superior.id
                        from empresas superior
                        inner join empresas_hierarquia eh on eh.superior_id = superior.id
                        where not superior.id = any(eh.caminho)
                    )
                    select distinct on (id)
                        id,
                        fantasia,
                        superior_id
                    from empresas_hierarquia
                    order by id, fantasia asc
                `,
                [idUsuario]
            );

            return criarRespostaApi<EmpresaArvoreNode[]>(
                true,
                "Árvore de empresas carregada com sucesso.",
                montarArvoreEmpresas(resultadoArvore.rows)
            );
        }

        if (listarSuperiores) {
            const filtrarEmpresaAtual = Number.isInteger(idEmpresaAtual) && idEmpresaAtual > 0;
            const parametros = filtrarEmpresaAtual ? [idUsuario, idEmpresaAtual] : [idUsuario];
            const filtroEmpresaAtual = filtrarEmpresaAtual ? "and e.id <> $2" : "";
            const resultadoSuperiores = await consultarBancoDados<EmpresaListada>(
                `
                    select
                        e.id,
                        e.fantasia,
                        e.cnpj,
                        e.email,
                        e.telefone,
                        e.ativo,
                        e.superior_id,
                        e.exigir_vinculo_produto,
                        e.suporte_visualiza_apenas_tickets_proprios,
                        e.criado_em,
                        e.atualizado_em
                    from empresas e
                    inner join usuarios_empresas ue on ue.empresa_id = e.id
                    where ue.usuario_id = $1
                        and e.ativo = true
                        ${filtroEmpresaAtual}
                    order by e.fantasia asc
                `,
                parametros
            );

            return criarRespostaApi(true, "Empresas superiores listadas com sucesso.", resultadoSuperiores.rows);
        }

        const resultado = await consultarBancoDados<EmpresaListada>(
            `
                select
                    e.id,
                    e.fantasia,
                    e.cnpj,
                    e.email,
                    e.telefone,
                    e.ativo,
                    e.superior_id,
                    superior.fantasia as superior_fantasia,
                    e.exigir_vinculo_produto,
                    e.suporte_visualiza_apenas_tickets_proprios,
                    e.criado_em,
                    e.atualizado_em
                from empresas e
                left join empresas superior on superior.id = e.superior_id
                inner join usuarios_empresas ue on ue.empresa_id = e.id
                where ue.usuario_id = $1
                order by e.criado_em desc
            `,
            [idUsuario]
        );

        return criarRespostaApi(true, "Empresas listadas com sucesso.", resultado.rows);
    } catch {
        return criarRespostaApi<EmpresaListada[]>(false, "Não foi possível listar as empresas.", [], 500);
    }
}

/**
 * Endpoint POST de empresas.
 * Valida os dados obrigatórios e cadastra uma empresa vinculando o usuário autenticado como criador.
 */
export async function POST(request: NextRequest) {
    try {
        const respostaPermissao = await verificarPermissaoAPI({
            request: request,
            recurso: "empresa",
            acao: "criar",
        });

        if (respostaPermissao) {
            return respostaPermissao;
        }

        const idUsuario = obterIdUsuarioAutenticado(request);

        if (!idUsuario) {
            return criarRespostaApi(false, "Sessão inválida ou expirada.", null, 401);
        }

        const body = await request.json() as CadastroEmpresaBody;
        const fantasia = validarStringComConteudo(body.fantasia) ? body.fantasia.trim() : "";
        const cnpj = normalizarCnpj(body.cnpj);
        const email = normalizarCampoOpcional(body.email)?.toLowerCase() ?? null;
        const telefone = normalizarCampoOpcional(body.telefone);
        const ativo = obterBooleanoAtivo(body.ativo);
        const superiorId = normalizarIdOpcional(body.superiorId ?? body.superior_id);
        const exigirVinculoProduto = typeof body.exigirVinculoProduto === "boolean"
            ? body.exigirVinculoProduto
            : false;
        const suporteVisualizaApenasTicketsProprios = typeof body.suporteVisualizaApenasTicketsProprios === "boolean"
            ? body.suporteVisualizaApenasTicketsProprios
            : true;

        if (!fantasia || fantasia.length > 160 || cnpj.length !== 14) {
            return criarRespostaApi(false, "Informe nome da empresa e CNPJ com 14 dígitos.", null, 400);
        }

        if (email && (!validarEmail(email) || email.length > 180)) {
            return criarRespostaApi(false, "Informe um e-mail válido para a empresa.", null, 400);
        }

        if (telefone && telefone.length > 20) {
            return criarRespostaApi(false, "Telefone deve respeitar o limite de caracteres.", null, 400);
        }

        const superiorValido = await validarEmpresaSuperior({
            idSuperior: superiorId,
            idUsuario: idUsuario,
        });

        if (!superiorValido) {
            return criarRespostaApi(false, "Informe uma empresa superior válida.", null, 400);
        }

        const resultado = await consultarBancoDados<EmpresaListada>(
            `
                insert into empresas (
                    fantasia,
                    cnpj,
                    email,
                    telefone,
                    ativo,
                    superior_id,
                    exigir_vinculo_produto,
                    suporte_visualiza_apenas_tickets_proprios,
                    criado_por
                )
                values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                returning id,
                    fantasia,
                    cnpj,
                    email,
                    telefone,
                    ativo,
                    superior_id,
                    exigir_vinculo_produto,
                    suporte_visualiza_apenas_tickets_proprios,
                    criado_em,
                    atualizado_em
            `,
            [fantasia, cnpj, email, telefone, ativo, superiorId, exigirVinculoProduto, suporteVisualizaApenasTicketsProprios, idUsuario]
        );

        await consultarBancoDados(
            `
                insert into usuarios_empresas (
                    usuario_id,
                    empresa_id,
                    criado_por
                )
                values ($1, $2, $3)
                on conflict (usuario_id, empresa_id) do nothing
            `,
            [idUsuario, resultado.rows[0].id, idUsuario]
        );

        try {
            await registrarAuditoriaSegura({
                acao: "CREATE",
                usuarioId: idUsuario,
                empresaId: resultado.rows[0].id,
                metodo: request.method,
                rota: request.nextUrl.pathname,
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

        return criarRespostaApi(true, "Empresa cadastrada com sucesso.", resultado.rows[0], 201);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe uma empresa cadastrada com este CNPJ.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível cadastrar a empresa.", null, 500);
    }
}

/**
 * Endpoint PUT de empresas.
 * Atualiza dados cadastrais e registra o usuário autenticado como responsável pela última alteração.
 */
export async function PUT(request: NextRequest) {
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

        const body = await request.json() as CadastroEmpresaBody;
        const id = typeof body.id === "number" ? body.id : Number(body.id);
        const fantasia = validarStringComConteudo(body.fantasia) ? body.fantasia.trim() : "";
        const cnpj = normalizarCnpj(body.cnpj);
        const email = normalizarCampoOpcional(body.email)?.toLowerCase() ?? null;
        const telefone = normalizarCampoOpcional(body.telefone);
        const ativo = obterBooleanoAtivo(body.ativo);
        const superiorId = normalizarIdOpcional(body.superiorId ?? body.superior_id);
        const exigirVinculoProduto = typeof body.exigirVinculoProduto === "boolean"
            ? body.exigirVinculoProduto
            : false;
        const suporteVisualizaApenasTicketsProprios = typeof body.suporteVisualizaApenasTicketsProprios === "boolean"
            ? body.suporteVisualizaApenasTicketsProprios
            : true;

        if (!Number.isInteger(id) || id <= 0) {
            return criarRespostaApi(false, "Informe uma empresa válida para atualização.", null, 400);
        }

        if (!fantasia || fantasia.length > 160 || cnpj.length !== 14) {
            return criarRespostaApi(false, "Informe nome da empresa e CNPJ com 14 dígitos.", null, 400);
        }

        if (email && (!validarEmail(email) || email.length > 180)) {
            return criarRespostaApi(false, "Informe um e-mail válido para a empresa.", null, 400);
        }

        if (telefone && telefone.length > 20) {
            return criarRespostaApi(false, "Telefone deve respeitar o limite de caracteres.", null, 400);
        }

        const superiorValido = await validarEmpresaSuperior({
            idSuperior: superiorId,
            idUsuario: idUsuario,
            idEmpresaAtual: id,
        });

        if (!superiorValido) {
            return criarRespostaApi(false, "Informe uma empresa superior válida.", null, 400);
        }

        const resultadoEmpresaAntes = await consultarBancoDados<EmpresaListada>(
            `
                select
                    id,
                    fantasia,
                    cnpj,
                    email,
                    telefone,
                    ativo,
                    superior_id,
                    exigir_vinculo_produto,
                    suporte_visualiza_apenas_tickets_proprios,
                    criado_em,
                    atualizado_em
                from empresas
                where id = $1
                limit 1
            `,
            [id]
        );

        const resultado = await consultarBancoDados<EmpresaListada>(
            `
                update empresas
                set
                    fantasia = $1,
                    cnpj = $2,
                    email = $3,
                    telefone = $4,
                    ativo = $5,
                    superior_id = $6,
                    exigir_vinculo_produto = $7,
                    suporte_visualiza_apenas_tickets_proprios = $8,
                    atualizado_por = $9,
                    atualizado_em = now()
                where id = $10
                returning id,
                    fantasia,
                    cnpj,
                    email,
                    telefone,
                    ativo,
                    superior_id,
                    exigir_vinculo_produto,
                    suporte_visualiza_apenas_tickets_proprios,
                    criado_em,
                    atualizado_em
            `,
            [fantasia, cnpj, email, telefone, ativo, superiorId, exigirVinculoProduto, suporteVisualizaApenasTicketsProprios, idUsuario, id]
        );

        if (!resultado.rows[0]) {
            return criarRespostaApi(false, "Empresa não encontrada.", null, 404);
        }

        try {
            await registrarAuditoriaSegura({
                acao: "UPDATE",
                usuarioId: idUsuario,
                empresaId: id,
                metodo: request.method,
                rota: request.nextUrl.pathname,
                dadosAntes: resultadoEmpresaAntes.rows[0],
                dadosDepois: resultado.rows[0],
            });
        } catch (erro) {

            console.error('ERRO AO GRAVAR LOG')
            console.error(erro)
        };

        return criarRespostaApi(true, "Empresa atualizada com sucesso.", resultado.rows[0]);
    } catch (erro) {
        if (erro instanceof SyntaxError) {
            return criarRespostaApi(false, "Requisição inválida.", null, 400);
        }

        if (erro instanceof Error && "code" in erro && erro.code === "23505") {
            return criarRespostaApi(false, "Já existe uma empresa cadastrada com este CNPJ.", null, 409);
        }

        return criarRespostaApi(false, "Não foi possível atualizar a empresa.", null, 500);
    }
}
