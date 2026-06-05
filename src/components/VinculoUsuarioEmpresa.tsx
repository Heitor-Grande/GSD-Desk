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
import { FaCheckCircle, FaExclamationTriangle, FaPlus, FaTrash } from "react-icons/fa";

export type TipoFormularioVinculo = "usuario" | "empresa";

export type UsuarioVinculo = {
    id: number;
    vinculoId: number;
    nome: string;
    email: string;
    empresaPadrao: boolean;
};

export type EmpresaVinculo = {
    id: number;
    vinculoId: number;
    nome: string;
    cnpj: string;
    empresaPadrao: boolean;
};

export type VinculoUsuarioEmpresaProps = {
    form: TipoFormularioVinculo;
    idUsuario?: number | null;
    idEmpresa?: number | null;
    nomeContexto?: string;
};

type OpcaoVinculo = {
    label: string;
    value: string;
};

type VinculoApi = {
    id: number;
    empresa_padrao: boolean;
};

type UsuarioVinculoApi = VinculoApi & {
    usuario_id: number;
    nome: string;
    email: string | null;
};

type EmpresaVinculoApi = VinculoApi & {
    empresa_id: number;
    fantasia: string;
    cnpj: string;
};

type EmpresaDisponivelApi = {
    id: number;
    fantasia: string;
    cnpj: string;
};

type EstadoPaginacao = {
    chave: string;
    pagina: number;
};

function obterListaDados<TipoItem>(dados: unknown): TipoItem[] {
    return Array.isArray(dados) ? dados as TipoItem[] : [];
}

function criarOpcoesEmpresas(empresas: EmpresaDisponivelApi[]): OpcaoVinculo[] {
    return empresas.map((empresa) => ({
        label: `${empresa.fantasia} - ${empresa.cnpj}`,
        value: String(empresa.id),
    }));
}

function mapearUsuarioVinculado(vinculo: UsuarioVinculoApi): UsuarioVinculo {
    return {
        id: vinculo.usuario_id,
        vinculoId: vinculo.id,
        nome: vinculo.nome,
        email: vinculo.email ?? "",
        empresaPadrao: vinculo.empresa_padrao,
    };
}

function mapearEmpresaVinculada(vinculo: EmpresaVinculoApi): EmpresaVinculo {
    return {
        id: vinculo.empresa_id,
        vinculoId: vinculo.id,
        nome: vinculo.fantasia,
        cnpj: vinculo.cnpj,
        empresaPadrao: vinculo.empresa_padrao,
    };
}

/**
 * Gerencia vínculos entre um usuário e suas empresas.
 * Use apenas no formulário de usuário, informando o id do usuário salvo.
 */
export default function VinculoUsuarioEmpresa({
    form,
    idUsuario,
    idEmpresa,
    nomeContexto,
}: VinculoUsuarioEmpresaProps) {
    const [usuariosVinculados, setUsuariosVinculados] = useState<UsuarioVinculo[]>([]);
    const [empresasVinculadas, setEmpresasVinculadas] = useState<EmpresaVinculo[]>([]);
    const [opcoesEmpresas, setOpcoesEmpresas] = useState<OpcaoVinculo[]>([]);
    const [opcaoSelecionada, setOpcaoSelecionada] = useState<OpcaoVinculo | null>(null);
    const [mensagemValidacao, setMensagemValidacao] = useState("");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Carregando vínculos...");
    const [idVinculoParaRemover, setIdVinculoParaRemover] = useState<number | null>(null);
    const [idEmpresaPadraoParaConfirmar, setIdEmpresaPadraoParaConfirmar] = useState<number | null>(null);
    const [paginacaoUsuariosVinculados, setPaginacaoUsuariosVinculados] = useState<EstadoPaginacao>({ chave: "", pagina: 1 });
    const [paginacaoEmpresasVinculadas, setPaginacaoEmpresasVinculadas] = useState<EstadoPaginacao>({ chave: "", pagina: 1 });

    const estaNoFormularioEmpresa = form === "empresa";
    const idContexto = estaNoFormularioEmpresa ? idEmpresa : idUsuario;
    const possuiContextoSalvo = typeof idContexto === "number" && idContexto > 0;
    const valorContextoFixo = nomeContexto || (possuiContextoSalvo ? "Registro em edição" : "Salve o registro para gerenciar vínculos");
    const chavePaginacao = `${form}-${idContexto ?? "novo"}`;
    const possuiVinculos = estaNoFormularioEmpresa
        ? usuariosVinculados.length > 0
        : empresasVinculadas.length > 0;
    const totalPaginasUsuarios = calcularTotalPaginas(usuariosVinculados.length);
    const totalPaginasEmpresas = calcularTotalPaginas(empresasVinculadas.length);
    const paginaUsuariosVinculados = Math.min(
        paginacaoUsuariosVinculados.chave === chavePaginacao ? paginacaoUsuariosVinculados.pagina : 1,
        totalPaginasUsuarios
    );
    const paginaEmpresasVinculadas = Math.min(
        paginacaoEmpresasVinculadas.chave === chavePaginacao ? paginacaoEmpresasVinculadas.pagina : 1,
        totalPaginasEmpresas
    );
    const usuariosVinculadosPaginados = useMemo(
        () => paginarLista(usuariosVinculados, paginaUsuariosVinculados),
        [paginaUsuariosVinculados, usuariosVinculados]
    );
    const empresasVinculadasPaginadas = useMemo(
        () => paginarLista(empresasVinculadas, paginaEmpresasVinculadas),
        [empresasVinculadas, paginaEmpresasVinculadas]
    );

    const carregarVinculos = useCallback(async () => {
        if (!possuiContextoSalvo) {
            setUsuariosVinculados([]);
            setEmpresasVinculadas([]);
            setOpcoesEmpresas([]);
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Carregando vínculos...");
        setMensagemValidacao("");

        try {
            if (estaNoFormularioEmpresa) {
                const respostaVinculos = await requisitarAPI(`/api/empresas/usuarios?empresaId=${idContexto}`, {
                    method: "GET",
                });
                const vinculos = obterListaDados<UsuarioVinculoApi>(respostaVinculos.dados);

                setUsuariosVinculados(vinculos.map(mapearUsuarioVinculado));
                setEmpresasVinculadas([]);
                setOpcoesEmpresas([]);
                return;
            }

            const respostaVinculos = await requisitarAPI(`/api/empresas/usuarios?usuarioId=${idUsuario}`, {
                method: "GET",
            });
            const respostaDisponiveis = await requisitarAPI(`/api/empresas/usuarios?usuarioId=${idUsuario}&disponiveis=true`, {
                method: "GET",
            });

            const vinculos = obterListaDados<EmpresaVinculoApi>(respostaVinculos.dados);
            const empresas = obterListaDados<EmpresaDisponivelApi>(respostaDisponiveis.dados);

            setEmpresasVinculadas(vinculos.map(mapearEmpresaVinculada));
            setOpcoesEmpresas(criarOpcoesEmpresas(empresas));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os vínculos.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [estaNoFormularioEmpresa, idContexto, idUsuario, possuiContextoSalvo]);

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarVinculos();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarVinculos]);

    async function adicionarVinculoSelecionado() {
        if (!possuiContextoSalvo) {
            setMensagemValidacao("Salve o registro antes de gerenciar vínculos.");
            return;
        }

        if (!opcaoSelecionada) {
            setMensagemValidacao("Selecione uma empresa antes de adicionar o vínculo.");
            return;
        }

        const idSelecionado = Number(opcaoSelecionada.value);

        if (!Number.isInteger(idSelecionado) || idSelecionado <= 0) {
            setMensagemValidacao("Selecione uma empresa válida para o vínculo.");
            return;
        }

        if (empresasVinculadas.some((empresa) => empresa.id === idSelecionado)) {
            setMensagemValidacao("Esta empresa já está vinculada ao usuário.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Criando vínculo...");
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI("/api/empresas/usuarios", {
                method: "POST",
                body: {
                    usuarioId: idUsuario,
                    empresaId: idSelecionado,
                },
            });

            setOpcaoSelecionada(null);
            setMensagemResposta(resposta.msg || "Vínculo criado com sucesso.");
            await carregarVinculos();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível criar o vínculo.";

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

    async function removerVinculoConfirmado() {
        if (!idVinculoParaRemover) {
            setMensagemResposta("Selecione um vínculo válido para remoção.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Removendo vínculo...");
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI(`/api/empresas/usuarios?id=${idVinculoParaRemover}`, {
                method: "DELETE",
            });

            setIdVinculoParaRemover(null);
            setMensagemResposta(resposta.msg || "Vínculo removido com sucesso.");
            await carregarVinculos();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível remover o vínculo.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function abrirConfirmacaoEmpresaPadrao(idEmpresaSelecionada: number) {
        setIdEmpresaPadraoParaConfirmar(idEmpresaSelecionada);
    }

    function cancelarEmpresaPadrao() {
        setIdEmpresaPadraoParaConfirmar(null);
    }

    async function tornarEmpresaPadraoConfirmada() {
        if (!idEmpresaPadraoParaConfirmar) {
            setMensagemResposta("Selecione uma empresa válida para definir como padrão.");
            return;
        }

        if (!idUsuario) {
            setMensagemResposta("Selecione um usuário válido para definir a empresa padrão.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Atualizando empresa padrão...");
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI("/api/empresas/usuarios", {
                method: "PATCH",
                body: {
                    usuarioId: idUsuario,
                    empresaId: idEmpresaPadraoParaConfirmar,
                },
            });

            setIdEmpresaPadraoParaConfirmar(null);
            setMensagemResposta(resposta.msg || "Empresa padrão atualizada com sucesso.");
            await carregarVinculos();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível atualizar a empresa padrão.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
                <h3 className="text-base font-bold text-slate-900">
                    {estaNoFormularioEmpresa ? "Usuários vinculados" : "Empresas vinculadas"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                    {estaNoFormularioEmpresa
                        ? "Consulte os usuários vinculados à empresa atual."
                        : "Selecione empresas ativas para vincular ao usuário atual."}
                </p>
            </div>

            {!estaNoFormularioEmpresa && (
                <div className="grid gap-4 md:grid-cols-12">
                    <div className="md:col-span-5">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor={`vinculo-contexto-${form}`}>
                            Usuário atual
                        </label>
                        <input
                            id={`vinculo-contexto-${form}`}
                            type="text"
                            value={valorContextoFixo}
                            disabled
                            className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 shadow-sm"
                        />
                    </div>

                    <div className="md:col-span-5">
                        <Seletor
                            id={`vinculo-${form}`}
                            label="Empresa"
                            options={opcoesEmpresas}
                            value={opcaoSelecionada}
                            onChange={(opcao) => {
                                setOpcaoSelecionada(opcao);
                                setMensagemValidacao("");
                            }}
                            placeholder="Selecione uma empresa"
                            isDisabled={carregando || !possuiContextoSalvo}
                            isClearable
                            className="mb-0"
                        />
                    </div>

                    <div className="flex items-end md:col-span-2">
                        <Botao
                            size="sm"
                            label="Adicionar"
                            icon={<FaPlus />}
                            onClick={adicionarVinculoSelecionado}
                            disabled={carregando || !possuiContextoSalvo}
                            loading={carregando}
                            variant="outline-primary"
                            type="button"
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            {mensagemValidacao && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                    {mensagemValidacao}
                </div>
            )}

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                {carregando && !possuiVinculos ? (
                    <div className="bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        Carregando vínculos...
                    </div>
                ) : possuiVinculos ? (
                    <div className="divide-y divide-slate-200">
                        {estaNoFormularioEmpresa
                            ? usuariosVinculadosPaginados.map((usuario) => (
                                <div key={usuario.vinculoId} className="bg-white p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">{usuario.nome}</p>
                                        {usuario.empresaPadrao && (
                                            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                                Empresa padrão
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{usuario.email || "-"}</p>
                                </div>
                            ))
                            : empresasVinculadasPaginadas.map((empresa) => (
                                <div key={empresa.vinculoId} className="flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-900">{empresa.nome}</p>
                                            {empresa.empresaPadrao && (
                                                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                                    Empresa padrão
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500">{empresa.cnpj}</p>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                        {!empresa.empresaPadrao && (
                                            <Botao
                                                size="sm"
                                                label="Tornar empresa padrão"
                                                icon={<FaCheckCircle />}
                                                onClick={() => abrirConfirmacaoEmpresaPadrao(empresa.id)}
                                                disabled={carregando}
                                                loading={false}
                                                variant="outline-primary"
                                                type="button"
                                                className="w-full sm:w-auto"
                                            />
                                        )}

                                        <Botao
                                            size="sm"
                                            label="Remover"
                                            icon={<FaTrash />}
                                            onClick={() => abrirConfirmacaoRemocao(empresa.vinculoId)}
                                            disabled={carregando}
                                            loading={false}
                                            variant="outline-danger"
                                            type="button"
                                            className="w-full sm:w-auto"
                                        />
                                    </div>
                                </div>
                            ))}

                        {estaNoFormularioEmpresa ? (
                            <Paginacao
                                paginaAtual={paginaUsuariosVinculados}
                                totalPaginas={totalPaginasUsuarios}
                                aoVoltar={() => setPaginacaoUsuariosVinculados({
                                    chave: chavePaginacao,
                                    pagina: Math.max(1, paginaUsuariosVinculados - 1),
                                })}
                                aoAvancar={() => setPaginacaoUsuariosVinculados({
                                    chave: chavePaginacao,
                                    pagina: Math.min(totalPaginasUsuarios, paginaUsuariosVinculados + 1),
                                })}
                            />
                        ) : (
                            <Paginacao
                                paginaAtual={paginaEmpresasVinculadas}
                                totalPaginas={totalPaginasEmpresas}
                                aoVoltar={() => setPaginacaoEmpresasVinculadas({
                                    chave: chavePaginacao,
                                    pagina: Math.max(1, paginaEmpresasVinculadas - 1),
                                })}
                                aoAvancar={() => setPaginacaoEmpresasVinculadas({
                                    chave: chavePaginacao,
                                    pagina: Math.min(totalPaginasEmpresas, paginaEmpresasVinculadas + 1),
                                })}
                            />
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        {possuiContextoSalvo
                            ? estaNoFormularioEmpresa
                                ? "Nenhum usuário vinculado a esta empresa."
                                : "Nenhuma empresa vinculada a este usuário."
                            : "Salve o registro para consultar vínculos."}
                    </div>
                )}
            </div>

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />

            <ModalConfirmacao
                isOpen={Boolean(idVinculoParaRemover)}
                message="Deseja realmente remover este vínculo?"
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={removerVinculoConfirmado}
                onCancel={cancelarRemocaoVinculo}
                confirmLabel="Remover"
                cancelLabel="Cancelar"
            />

            <ModalConfirmacao
                isOpen={Boolean(idEmpresaPadraoParaConfirmar)}
                message="Deseja tornar esta empresa a empresa padrão do usuário?"
                icon={<FaExclamationTriangle className="text-4xl text-blue-600" />}
                onConfirm={tornarEmpresaPadraoConfirmada}
                onCancel={cancelarEmpresaPadrao}
                confirmLabel="Confirmar"
                cancelLabel="Cancelar"
            />

            <ModalCarregamento
                show={carregando}
                text={textoCarregamento}
            />
        </section>
    );
}
