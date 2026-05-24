"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import ModalConfirmacao from "@/components/modals/confirmModal";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FaBan, FaExclamationTriangle, FaPlus, FaSave, FaTimes } from "react-icons/fa";

export type Produto = {
    id: number;
    empresa_id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    criado_em: string;
    criado_por: number;
    atualizado_em: string | null;
};

export type ProdutoFormulario = {
    id: number | null;
    nome: string;
    descricao: string;
    ativo: boolean;
};

type ProdutosEmpresaProps = {
    idEmpresa?: number | null;
};

const estadoInicialProduto: ProdutoFormulario = {
    id: null,
    nome: "",
    descricao: "",
    ativo: true,
};

function obterListaProdutos(dados: unknown): Produto[] {
    return Array.isArray(dados) ? dados as Produto[] : [];
}

function normalizarNomeProduto(valor: string): string {
    return valor.trim().toLowerCase();
}

function mapearProdutoParaFormulario(produto: Produto): ProdutoFormulario {
    return {
        id: produto.id,
        nome: produto.nome,
        descricao: produto.descricao || "",
        ativo: produto.ativo,
    };
}

/**
 * Gerencia produtos vinculados ao cadastro de empresa.
 * Use dentro do modal de empresa, onde a empresa atual é o contexto fixo.
 */
export default function ProdutosEmpresa({ idEmpresa }: ProdutosEmpresaProps) {
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [formulario, setFormulario] = useState<ProdutoFormulario>(estadoInicialProduto);
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Processando solicitação...");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [mensagemValidacao, setMensagemValidacao] = useState("");
    const [idProdutoParaExcluir, setIdProdutoParaExcluir] = useState<number | null>(null);

    const possuiEmpresaSalva = typeof idEmpresa === "number" && idEmpresa > 0;
    const estaEditandoProduto = typeof formulario.id === "number" && formulario.id > 0;

    const produtoSelecionadoParaExcluir = useMemo(
        () => produtos.find((produto) => produto.id === idProdutoParaExcluir) || null,
        [idProdutoParaExcluir, produtos]
    );

    const carregarProdutos = useCallback(async () => {
        if (!possuiEmpresaSalva) {
            setProdutos([]);
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Carregando produtos...");
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI(`/api/empresas/produtos?empresaId=${idEmpresa}`, {
                method: "GET",
            });

            setProdutos(obterListaProdutos(resposta.dados));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os produtos.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [idEmpresa, possuiEmpresaSalva]);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarProdutos();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarProdutos]);

    function atualizarCampoFormulario(campo: keyof ProdutoFormulario, valor: string | boolean) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
        setMensagemValidacao("");
    }

    function limparFormularioProduto() {
        setFormulario(estadoInicialProduto);
        setMensagemValidacao("");
    }

    function selecionarProdutoParaEdicao(produto: Produto) {
        setFormulario(mapearProdutoParaFormulario(produto));
        setMensagemValidacao("");
    }

    function validarDuplicidadeProduto(): boolean {
        const nomeNormalizado = normalizarNomeProduto(formulario.nome);

        return produtos.some((produto) => (
            produto.id !== formulario.id
            && produto.ativo
            && normalizarNomeProduto(produto.nome) === nomeNormalizado
        ));
    }

    async function salvarProduto(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMensagemResposta("");

        if (!possuiEmpresaSalva) {
            setMensagemValidacao("Salve a empresa antes de cadastrar produtos.");
            return;
        }

        if (!formulario.nome.trim()) {
            setMensagemValidacao("Informe o nome do produto.");
            return;
        }

        if (validarDuplicidadeProduto()) {
            setMensagemValidacao("Já existe um produto ativo com este nome nesta empresa.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento(estaEditandoProduto ? "Atualizando produto..." : "Cadastrando produto...");
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI("/api/empresas/produtos", {
                method: estaEditandoProduto ? "PUT" : "POST",
                body: {
                    id: formulario.id,
                    empresaId: idEmpresa,
                    nome: formulario.nome,
                    descricao: formulario.descricao,
                    ativo: formulario.ativo,
                },
            });

            limparFormularioProduto();
            setMensagemResposta(resposta.msg || "Produto salvo com sucesso.");
            await carregarProdutos();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível salvar o produto.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function abrirConfirmacaoExclusao(idProduto: number) {
        setIdProdutoParaExcluir(idProduto);
    }

    function cancelarExclusaoProduto() {
        setIdProdutoParaExcluir(null);
    }

    async function excluirProdutoConfirmado() {
        if (!idProdutoParaExcluir || !idEmpresa) {
            setMensagemResposta("Selecione um produto válido para exclusão.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Excluindo produto...");

        try {
            const resposta = await requisitarAPI(`/api/empresas/produtos?id=${idProdutoParaExcluir}&empresaId=${idEmpresa}`, {
                method: "DELETE",
            });

            setIdProdutoParaExcluir(null);
            limparFormularioProduto();
            setMensagemResposta(resposta.msg || "Produto excluído com sucesso.");
            await carregarProdutos();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível excluir o produto.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    if (!possuiEmpresaSalva) {
        return (
            <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm font-medium text-amber-800">
                Salve a empresa antes de cadastrar produtos.
            </section>
        );
    }

    return (
        <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900">
                        {estaEditandoProduto ? "Editar produto" : "Novo produto"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        Cadastre produtos vinculados somente à empresa atual.
                    </p>
                </div>

                <form onSubmit={salvarProduto}>
                    <div className="grid gap-4 md:grid-cols-12">
                        <div className="md:col-span-5">
                            <CampoTexto
                                id="produto-nome"
                                label="Nome"
                                type="text"
                                value={formulario.nome}
                                placeholder="Nome do produto"
                                onChange={(event) => atualizarCampoFormulario("nome", event.target.value)}
                                disabled={carregando}
                                required
                                className="mb-0"
                            />
                        </div>

                        <div className="md:col-span-5">
                            <CampoTexto
                                id="produto-descricao"
                                label="Descrição"
                                type="text"
                                value={formulario.descricao}
                                placeholder="Descrição opcional"
                                onChange={(event) => atualizarCampoFormulario("descricao", event.target.value)}
                                disabled={carregando}
                                required={false}
                                className="mb-0"
                            />
                        </div>

                        <div className="flex items-end md:col-span-2">
                            <div className="flex min-h-9 items-center gap-3 pb-1">
                                <input
                                    id="produto-ativo"
                                    className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    type="checkbox"
                                    checked={formulario.ativo}
                                    disabled={carregando}
                                    onChange={(event) => atualizarCampoFormulario("ativo", event.target.checked)}
                                />
                                <label className="text-sm font-semibold text-slate-700" htmlFor="produto-ativo">
                                    Ativo
                                </label>
                            </div>
                        </div>
                    </div>

                    {mensagemValidacao && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                            {mensagemValidacao}
                        </div>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {estaEditandoProduto && (
                            <Botao
                                size="sm"
                                label="Cancelar edição"
                                icon={<FaTimes />}
                                onClick={limparFormularioProduto}
                                disabled={carregando}
                                loading={false}
                                variant="outline-secondary"
                                type="button"
                                className="w-full sm:w-auto"
                            />
                        )}

                        <Botao
                            size="sm"
                            label={estaEditandoProduto ? "Salvar alterações" : "Adicionar produto"}
                            icon={estaEditandoProduto ? <FaSave /> : <FaPlus />}
                            onClick={() => undefined}
                            disabled={carregando}
                            loading={carregando}
                            variant="outline-primary"
                            type="submit"
                            className="w-full sm:w-auto"
                        />
                    </div>
                </form>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
                {carregando && produtos.length === 0 ? (
                    <div className="bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Carregando produtos...
                    </div>
                ) : produtos.length > 0 ? (
                    <div className="divide-y divide-slate-200">
                        {produtos.map((produto) => (
                            <div key={produto.id} className="flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">{produto.nome}</p>
                                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${produto.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                                            {produto.ativo ? "Ativo" : "Inativo"}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {produto.descricao || "Sem descrição."}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Botao
                                        size="sm"
                                        label="Editar"
                                        icon={<FaSave />}
                                        onClick={() => selecionarProdutoParaEdicao(produto)}
                                        disabled={carregando}
                                        loading={false}
                                        variant="outline-primary"
                                        type="button"
                                        className="w-full sm:w-auto"
                                    />

                                    {produto.ativo && (
                                        <Botao
                                            size="sm"
                                            label="Excluir"
                                            icon={<FaBan />}
                                            onClick={() => abrirConfirmacaoExclusao(produto.id)}
                                            disabled={carregando}
                                            loading={false}
                                            variant="outline-danger"
                                            type="button"
                                            className="w-full sm:w-auto"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Nenhum produto cadastrado para esta empresa.
                    </div>
                )}
            </div>

            <ModalConfirmacao
                isOpen={Boolean(idProdutoParaExcluir)}
                message={`Deseja realmente excluir ${produtoSelecionadoParaExcluir?.nome || "este produto"}?`}
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={excluirProdutoConfirmado}
                onCancel={cancelarExclusaoProduto}
                confirmLabel="Excluir"
                cancelLabel="Cancelar"
            />

            <ModalCarregamento
                show={carregando}
                text={textoCarregamento}
            />

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </section>
    );
}
