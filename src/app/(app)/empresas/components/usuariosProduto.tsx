"use client";

import { Botao } from "@/components/inputs/button";
import { Seletor } from "@/components/inputs/select";
import ModalConfirmacao from "@/components/modals/confirmModal";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import Paginacao from "@/components/Paginacao";
import { requisitarAPI } from "@/utils/api";
import { calcularTotalPaginas, paginarLista } from "@/utils/paginacao";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaExclamationTriangle, FaPlus, FaTrash } from "react-icons/fa";

export type UsuarioProduto = {
    id: number;
    usuarioId: number;
    nome: string;
    email: string;
};

export type UsuarioProdutoFormulario = {
    usuarioId: number | null;
};

export type UsuarioDisponivelProduto = {
    id: number;
    nome: string;
    email: string;
};

type UsuarioProdutoApi = {
    id: number;
    usuario_id: number;
    nome: string;
    email: string | null;
};

type OpcaoUsuarioProduto = {
    label: string;
    value: string;
};

type EstadoPaginacao = {
    chave: string;
    pagina: number;
};

type UsuariosProdutoProps = {
    empresaId: number;
    produtoId: number | null;
    nomeProduto: string;
    exigirVinculoProduto: boolean;
};

const estadoInicialFormulario: UsuarioProdutoFormulario = {
    usuarioId: null,
};

function obterListaDados<TipoItem>(dados: unknown): TipoItem[] {
    return Array.isArray(dados) ? dados as TipoItem[] : [];
}

function mapearUsuarioProduto(vinculo: UsuarioProdutoApi): UsuarioProduto {
    return {
        id: vinculo.id,
        usuarioId: vinculo.usuario_id,
        nome: vinculo.nome,
        email: vinculo.email || "",
    };
}

function criarOpcoesUsuarios(usuarios: UsuarioDisponivelProduto[]): OpcaoUsuarioProduto[] {
    return usuarios.map((usuario) => ({
        label: `${usuario.nome} - ${usuario.email}`,
        value: String(usuario.id),
    }));
}

/**
 * Gerencia vínculos entre usuários da empresa e o produto selecionado.
 * Use na aba Produtos quando houver um produto salvo em edição.
 */
export default function UsuariosProduto({
    empresaId,
    produtoId,
    nomeProduto,
    exigirVinculoProduto,
}: UsuariosProdutoProps) {
    const [usuariosVinculados, setUsuariosVinculados] = useState<UsuarioProduto[]>([]);
    const [opcoesUsuarios, setOpcoesUsuarios] = useState<OpcaoUsuarioProduto[]>([]);
    const [formulario, setFormulario] = useState<UsuarioProdutoFormulario>(estadoInicialFormulario);
    const [mensagemValidacao, setMensagemValidacao] = useState("");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Carregando usuários do produto...");
    const [idVinculoParaRemover, setIdVinculoParaRemover] = useState<number | null>(null);
    const [paginacaoUsuariosProduto, setPaginacaoUsuariosProduto] = useState<EstadoPaginacao>({ chave: "", pagina: 1 });

    const possuiProdutoSalvo = typeof produtoId === "number" && produtoId > 0;
    const chavePaginacaoProduto = String(produtoId ?? "novo");
    const totalPaginasUsuariosProduto = calcularTotalPaginas(usuariosVinculados.length);
    const paginaUsuariosProduto = Math.min(
        paginacaoUsuariosProduto.chave === chavePaginacaoProduto ? paginacaoUsuariosProduto.pagina : 1,
        totalPaginasUsuariosProduto
    );
    const usuariosVinculadosPaginados = useMemo(
        () => paginarLista(usuariosVinculados, paginaUsuariosProduto),
        [paginaUsuariosProduto, usuariosVinculados]
    );
    const opcaoSelecionada = useMemo(
        () => opcoesUsuarios.find((opcao) => Number(opcao.value) === formulario.usuarioId) || null,
        [formulario.usuarioId, opcoesUsuarios]
    );

    const carregarUsuariosProduto = useCallback(async () => {
        if (!possuiProdutoSalvo) {
            setUsuariosVinculados([]);
            setOpcoesUsuarios([]);
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Carregando usuários do produto...");
        setMensagemValidacao("");

        try {
            const respostaVinculos = await requisitarAPI(`/api/empresas/produtos/usuarios?empresaId=${empresaId}&produtoId=${produtoId}`, {
                method: "GET",
            });
            const respostaDisponiveis = await requisitarAPI(`/api/empresas/produtos/usuarios?empresaId=${empresaId}&produtoId=${produtoId}&disponiveis=true`, {
                method: "GET",
            });

            setUsuariosVinculados(obterListaDados<UsuarioProdutoApi>(respostaVinculos.dados).map(mapearUsuarioProduto));
            setOpcoesUsuarios(criarOpcoesUsuarios(obterListaDados<UsuarioDisponivelProduto>(respostaDisponiveis.dados)));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os usuários vinculados ao produto.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [empresaId, produtoId, possuiProdutoSalvo]);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarUsuariosProduto();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarUsuariosProduto]);

    async function adicionarUsuarioProduto() {
        if (!possuiProdutoSalvo) {
            setMensagemValidacao("Salve o produto antes de vincular usuários.");
            return;
        }

        if (!formulario.usuarioId) {
            setMensagemValidacao("Selecione um usuário para vincular ao produto.");
            return;
        }

        if (usuariosVinculados.some((usuario) => usuario.usuarioId === formulario.usuarioId)) {
            setMensagemValidacao("Este usuário já está vinculado ao produto.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Criando vínculo do produto...");
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI("/api/empresas/produtos/usuarios", {
                method: "POST",
                body: {
                    empresaId: empresaId,
                    produtoId: produtoId,
                    usuarioId: formulario.usuarioId,
                },
            });

            setFormulario(estadoInicialFormulario);
            setMensagemResposta(resposta.msg || "Usuário vinculado ao produto com sucesso.");
            await carregarUsuariosProduto();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível vincular o usuário ao produto.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function abrirConfirmacaoRemocao(idVinculo: number) {
        setIdVinculoParaRemover(idVinculo);
    }

    function cancelarRemocaoVinculo() {
        setIdVinculoParaRemover(null);
    }

    async function removerUsuarioProdutoConfirmado() {
        if (!idVinculoParaRemover || !produtoId) {
            setMensagemResposta("Selecione um vínculo válido para remoção.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Removendo vínculo do produto...");

        try {
            const resposta = await requisitarAPI(`/api/empresas/produtos/usuarios?id=${idVinculoParaRemover}&empresaId=${empresaId}&produtoId=${produtoId}`, {
                method: "DELETE",
            });

            setIdVinculoParaRemover(null);
            setMensagemResposta(resposta.msg || "Vínculo do produto removido com sucesso.");
            await carregarUsuariosProduto();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível remover o vínculo do produto.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    if (possuiProdutoSalvo) {

        return (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900">Usuários vinculados ao produto</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        Produto em edição: <span className="font-semibold text-slate-700">{nomeProduto}</span>
                    </p>
                    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm font-medium ${exigirVinculoProduto ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {exigirVinculoProduto
                            ? "A regra está ativa: futuramente apenas usuários vinculados ao produto poderão atendê-lo."
                            : "A regra está desabilitada: os vínculos podem ser cadastrados, mas ainda não restringem atendimento."}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-9">
                        <Seletor
                            id="usuario-produto"
                            label="Usuário"
                            options={opcoesUsuarios}
                            value={opcaoSelecionada}
                            onChange={(opcao) => {
                                setFormulario({
                                    usuarioId: opcao ? Number(opcao.value) : null,
                                });
                                setMensagemValidacao("");
                            }}
                            placeholder="Selecione um usuário vinculado à empresa"
                            isDisabled={carregando}
                            isClearable
                            className="mb-0"
                        />
                    </div>

                    <div className="flex items-end md:col-span-3">
                        <Botao
                            size="sm"
                            label="Vincular"
                            icon={<FaPlus />}
                            onClick={adicionarUsuarioProduto}
                            disabled={carregando}
                            loading={carregando}
                            variant="outline-primary"
                            type="button"
                            className="w-full"
                        />
                    </div>
                </div>

                {mensagemValidacao && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                        {mensagemValidacao}
                    </div>
                )}

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                    {usuariosVinculados.length > 0 ? (
                        <div className="divide-y divide-slate-200">
                            {usuariosVinculadosPaginados.map((usuario) => (
                                <div key={usuario.id} className="flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{usuario.nome}</p>
                                        <p className="text-sm text-slate-500">{usuario.email || "-"}</p>
                                    </div>

                                    <Botao
                                        size="sm"
                                        label="Remover"
                                        icon={<FaTrash />}
                                        onClick={() => abrirConfirmacaoRemocao(usuario.id)}
                                        disabled={carregando}
                                        loading={false}
                                        variant="outline-danger"
                                        type="button"
                                        className="w-full sm:w-auto"
                                    />
                                </div>
                            ))}
                            <Paginacao
                                paginaAtual={paginaUsuariosProduto}
                                totalPaginas={totalPaginasUsuariosProduto}
                                aoVoltar={() => setPaginacaoUsuariosProduto({
                                    chave: chavePaginacaoProduto,
                                    pagina: Math.max(1, paginaUsuariosProduto - 1),
                                })}
                                aoAvancar={() => setPaginacaoUsuariosProduto({
                                    chave: chavePaginacaoProduto,
                                    pagina: Math.min(totalPaginasUsuariosProduto, paginaUsuariosProduto + 1),
                                })}
                            />
                        </div>
                    ) : (
                        <div className="bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                            Nenhum usuário vinculado a este produto.
                        </div>
                    )}
                </div>

                <ModalConfirmacao
                    isOpen={Boolean(idVinculoParaRemover)}
                    message="Deseja realmente remover este usuário do produto?"
                    icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                    onConfirm={removerUsuarioProdutoConfirmado}
                    onCancel={cancelarRemocaoVinculo}
                    confirmLabel="Remover"
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
}
