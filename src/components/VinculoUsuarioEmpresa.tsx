"use client";

import { Botao } from "@/components/inputs/button";
import { Seletor } from "@/components/inputs/select";
import ModalConfirmacao from "@/components/modals/confirmModal";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
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

type UsuarioDisponivelApi = {
    id: number;
    nome: string;
    email: string;
};

type EmpresaDisponivelApi = {
    id: number;
    fantasia: string;
    cnpj: string;
};

function obterListaDados<TipoItem>(dados: unknown): TipoItem[] {
    return Array.isArray(dados) ? dados as TipoItem[] : [];
}

function criarOpcoesUsuarios(usuarios: UsuarioDisponivelApi[]): OpcaoVinculo[] {
    return usuarios.map((usuario) => ({
        label: `${usuario.nome} - ${usuario.email}`,
        value: String(usuario.id),
    }));
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
 * Gerencia vínculos reais entre usuários e empresas nos formulários do template.
 * Use no formulário de usuário ou empresa informando o id do contexto fixo correspondente.
 */
export default function VinculoUsuarioEmpresa({
    form,
    idUsuario,
    idEmpresa,
    nomeContexto,
}: VinculoUsuarioEmpresaProps) {
    const [usuariosVinculados, setUsuariosVinculados] = useState<UsuarioVinculo[]>([]);
    const [empresasVinculadas, setEmpresasVinculadas] = useState<EmpresaVinculo[]>([]);
    const [opcoesUsuarios, setOpcoesUsuarios] = useState<OpcaoVinculo[]>([]);
    const [opcoesEmpresas, setOpcoesEmpresas] = useState<OpcaoVinculo[]>([]);
    const [opcaoSelecionada, setOpcaoSelecionada] = useState<OpcaoVinculo | null>(null);
    const [mensagemValidacao, setMensagemValidacao] = useState("");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [carregando, setCarregando] = useState(false);
    const [idVinculoParaRemover, setIdVinculoParaRemover] = useState<number | null>(null);
    const [idEmpresaPadraoParaConfirmar, setIdEmpresaPadraoParaConfirmar] = useState<number | null>(null);

    const estaNoFormularioEmpresa = form === "empresa";
    const idContexto = estaNoFormularioEmpresa ? idEmpresa : idUsuario;
    const possuiContextoSalvo = typeof idContexto === "number" && idContexto > 0;
    const tituloSecao = estaNoFormularioEmpresa ? "Usuários vinculados" : "Empresas vinculadas";
    const textoAuxiliar = estaNoFormularioEmpresa
        ? "Selecione usuários ativos para vincular à empresa atual."
        : "Selecione empresas ativas para vincular ao usuário atual.";
    const labelContextoFixo = estaNoFormularioEmpresa ? "Empresa atual" : "Usuário atual";
    const valorContextoFixo = nomeContexto || (possuiContextoSalvo ? "Registro em edição" : "Salve o registro para gerenciar vínculos");
    const labelSeletor = estaNoFormularioEmpresa ? "Usuário" : "Empresa";
    const placeholderSeletor = estaNoFormularioEmpresa ? "Selecione um usuário" : "Selecione uma empresa";
    const textoEstadoVazio = estaNoFormularioEmpresa
        ? "Nenhum usuário vinculado a esta empresa."
        : "Nenhuma empresa vinculada a este usuário.";

    const opcoesDisponiveis = useMemo(() => (
        estaNoFormularioEmpresa ? opcoesUsuarios : opcoesEmpresas
    ), [estaNoFormularioEmpresa, opcoesEmpresas, opcoesUsuarios]);

    const possuiVinculos = estaNoFormularioEmpresa
        ? usuariosVinculados.length > 0
        : empresasVinculadas.length > 0;

    const carregarVinculos = useCallback(async () => {
        if (!possuiContextoSalvo) {
            setUsuariosVinculados([]);
            setEmpresasVinculadas([]);
            setOpcoesUsuarios([]);
            setOpcoesEmpresas([]);
            return;
        }

        setCarregando(true);
        setMensagemValidacao("");

        try {
            const parametroContexto = estaNoFormularioEmpresa ? `empresaId=${idContexto}` : `usuarioId=${idContexto}`;
            const respostaVinculos = await requisitarAPI(`/api/empresas/usuarios?${parametroContexto}`, {
                method: "GET",
            });
            const respostaDisponiveis = await requisitarAPI(`/api/empresas/usuarios?${parametroContexto}&disponiveis=true`, {
                method: "GET",
            });

            if (estaNoFormularioEmpresa) {
                const vinculos = obterListaDados<UsuarioVinculoApi>(respostaVinculos.dados);
                const usuarios = obterListaDados<UsuarioDisponivelApi>(respostaDisponiveis.dados);

                setUsuariosVinculados(vinculos.map(mapearUsuarioVinculado));
                setOpcoesUsuarios(criarOpcoesUsuarios(usuarios));
                return;
            }

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
    }, [estaNoFormularioEmpresa, idContexto, possuiContextoSalvo]);

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
            setMensagemValidacao("Selecione um item antes de adicionar o vínculo.");
            return;
        }

        const idSelecionado = Number(opcaoSelecionada.value);

        if (!Number.isInteger(idSelecionado) || idSelecionado <= 0) {
            setMensagemValidacao("Selecione um item válido para o vínculo.");
            return;
        }

        if (estaNoFormularioEmpresa && usuariosVinculados.some((usuario) => usuario.id === idSelecionado)) {
            setMensagemValidacao("Este usuário já está vinculado à empresa.");
            return;
        }

        if (!estaNoFormularioEmpresa && empresasVinculadas.some((empresa) => empresa.id === idSelecionado)) {
            setMensagemValidacao("Esta empresa já está vinculada ao usuário.");
            return;
        }

        setCarregando(true);
        setMensagemValidacao("");

        try {
            const resposta = await requisitarAPI("/api/empresas/usuarios", {
                method: "POST",
                body: {
                    usuarioId: estaNoFormularioEmpresa ? idSelecionado : idUsuario,
                    empresaId: estaNoFormularioEmpresa ? idEmpresa : idSelecionado,
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
                <h3 className="text-base font-bold text-slate-900">{tituloSecao}</h3>
                <p className="mt-1 text-sm text-slate-500">{textoAuxiliar}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-12">
                <div className="md:col-span-5">
                    <label className="block text-sm font-semibold text-slate-700" htmlFor={`vinculo-contexto-${form}`}>
                        {labelContextoFixo}
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
                        label={labelSeletor}
                        options={opcoesDisponiveis}
                        value={opcaoSelecionada}
                        onChange={(opcao) => {
                            setOpcaoSelecionada(opcao);
                            setMensagemValidacao("");
                        }}
                        placeholder={placeholderSeletor}
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
                            ? usuariosVinculados.map((usuario) => (
                                <div key={usuario.vinculoId} className="flex flex-col gap-3 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-slate-900">{usuario.nome}</p>
                                            {usuario.empresaPadrao && (
                                                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                                    Empresa padrão
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500">{usuario.email}</p>
                                    </div>

                                    <Botao
                                        size="sm"
                                        label="Remover"
                                        icon={<FaTrash />}
                                        onClick={() => abrirConfirmacaoRemocao(usuario.vinculoId)}
                                        disabled={carregando}
                                        loading={false}
                                        variant="outline-danger"
                                        type="button"
                                        className="w-full sm:w-auto"
                                    />
                                </div>
                            ))
                            : empresasVinculadas.map((empresa) => (
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
                    </div>
                ) : (
                    <div className="bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                        {possuiContextoSalvo ? textoEstadoVazio : "Salve o registro para gerenciar vínculos."}
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
        </section>
    );
}
