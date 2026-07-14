"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import ModalConfirmacao from "@/components/modals/confirmModal";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaExclamationTriangle, FaSave, FaTimes, FaTrash } from "react-icons/fa";

export type RecursoPermissaoPerfil = "dashboard" | "usuario" | "empresa" | "produto_empresa" | "configuracao" | "perfil" | "ticket";

export type PermissaoPerfil = {
    criar: boolean;
    deletar: boolean;
    atualizar: boolean;
    visualizar: boolean;
};

export type DadosPerfil = {
    id: number;
    nome: string;
    descricao: string;
    ativo: boolean;
    permissoes: Record<RecursoPermissaoPerfil, PermissaoPerfil>;
};

type PerfilDetalhadoApi = {
    id: number;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    permissoes: Record<RecursoPermissaoPerfil, PermissaoPerfil>;
};

interface ModalCadastroPerfilProps {
    aberto: boolean;
    idPerfil?: number | null;
    aoFechar: () => void;
}

const recursosPermissao: Array<{ chave: RecursoPermissaoPerfil; titulo: string }> = [
    { chave: "dashboard", titulo: "Dashboard" },
    { chave: "usuario", titulo: "Usuário" },
    { chave: "empresa", titulo: "Empresa" },
    { chave: "produto_empresa", titulo: "Produtos Emp/Usr" },
    { chave: "ticket", titulo: "Tickets" },
    { chave: "configuracao", titulo: "Configuração" },
    { chave: "perfil", titulo: "Perfil" },
];

const acoesPermissao: Array<{ chave: keyof PermissaoPerfil; titulo: string }> = [
    { chave: "visualizar", titulo: "Visualizar" },
    { chave: "criar", titulo: "Criar" },
    { chave: "atualizar", titulo: "Atualizar" },
    { chave: "deletar", titulo: "Deletar" },
];

const permissoesIniciais: Record<RecursoPermissaoPerfil, PermissaoPerfil> = {
    dashboard: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
    usuario: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
    empresa: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
    produto_empresa: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
    ticket: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
    configuracao: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
    perfil: {
        criar: false,
        deletar: false,
        atualizar: false,
        visualizar: false,
    },
};

const estadoInicialPerfil: DadosPerfil = {
    id: 0,
    nome: "",
    descricao: "",
    ativo: true,
    permissoes: permissoesIniciais,
};

/**
 * Cria uma cópia independente das permissões para evitar mutação compartilhada entre perfis.
 * Use ao iniciar ou carregar o formulário de perfil.
 */
function clonarPermissoes(permissoes: Record<RecursoPermissaoPerfil, PermissaoPerfil>) {
    return {
        dashboard: { ...permissoes.dashboard },
        usuario: { ...permissoes.usuario },
        empresa: { ...permissoes.empresa },
        produto_empresa: { ...permissoes.produto_empresa },
        ticket: { ...permissoes.ticket },
        configuracao: { ...permissoes.configuracao },
        perfil: { ...permissoes.perfil },
    };
}

function normalizarPermissoesPerfil(permissoes: Partial<Record<RecursoPermissaoPerfil, PermissaoPerfil>>) {
    return clonarPermissoes({
        ...permissoesIniciais,
        ...permissoes,
        dashboard: {
            ...permissoesIniciais.dashboard,
            ...permissoes.dashboard,
        },
        usuario: {
            ...permissoesIniciais.usuario,
            ...permissoes.usuario,
        },
        empresa: {
            ...permissoesIniciais.empresa,
            ...permissoes.empresa,
        },
        produto_empresa: {
            ...permissoesIniciais.produto_empresa,
            ...permissoes.produto_empresa,
        },
        ticket: {
            ...permissoesIniciais.ticket,
            ...permissoes.ticket,
        },
        configuracao: {
            ...permissoesIniciais.configuracao,
            ...permissoes.configuracao,
        },
        perfil: {
            ...permissoesIniciais.perfil,
            ...permissoes.perfil,
        },
    });
}

function mapearPerfilParaFormulario(perfil: PerfilDetalhadoApi): DadosPerfil {
    return {
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao || "",
        ativo: perfil.ativo,
        permissoes: normalizarPermissoesPerfil(perfil.permissoes),
    };
}

/**
 * Modal local de cadastro e edição de perfil.
 * Use no fluxo de perfis para cadastrar, atualizar e excluir permissões base da aplicação.
 */
export default function ModalCadastroPerfil({
    aberto,
    idPerfil,
    aoFechar,
}: ModalCadastroPerfilProps) {
    const [formulario, setFormulario] = useState<DadosPerfil>(estadoInicialPerfil);
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Processando solicitação...");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalConfirmacaoExclusaoAberto, setModalConfirmacaoExclusaoAberto] = useState(false);

    const estaEditandoPerfil = typeof idPerfil === "number" && idPerfil > 0;

    function atualizarCampoFormulario(campo: keyof DadosPerfil, valor: string | boolean) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    function atualizarPermissao(
        recurso: RecursoPermissaoPerfil,
        permissao: keyof PermissaoPerfil,
        valor: boolean
    ) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            permissoes: {
                ...estadoAtual.permissoes,
                [recurso]: {
                    ...estadoAtual.permissoes[recurso],
                    [permissao]: valor,
                },
            },
        }));
    }

    /**
     * Carrega os dados do perfil selecionado para preencher o formulário.
     */
    const carregarPerfilSelecionado = useCallback(async () => {
        if (!idPerfil) {
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Carregando perfil...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI(`/api/perfil?id=${idPerfil}`, {
                method: "GET",
            });

            const perfil = resposta.dados as PerfilDetalhadoApi | null;

            if (!perfil) {
                setMensagemResposta("Não foi possível carregar os dados do perfil.");
                return;
            }

            setFormulario(mapearPerfilParaFormulario(perfil));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados do perfil.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [idPerfil]);

    /**
     * Executa o cadastro ou atualização do perfil usando a API.
     */
    async function salvarPerfil(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMensagemResposta("");

        if (!formulario.nome.trim()) {
            setMensagemResposta("Informe o nome do perfil.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento(estaEditandoPerfil ? "Atualizando perfil..." : "Cadastrando perfil...");

        try {
            const resposta = await requisitarAPI("/api/perfil", {
                method: estaEditandoPerfil ? "PUT" : "POST",
                body: {
                    id: formulario.id,
                    nome: formulario.nome,
                    descricao: formulario.descricao,
                    ativo: formulario.ativo,
                    permissoes: formulario.permissoes,
                },
            });

            const mensagem = typeof resposta.msg === "string"
                ? resposta.msg
                : "Perfil salvo com sucesso.";

            setMensagemResposta(mensagem);
            setFormulario(estadoInicialPerfil);
            aoFechar();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível salvar o perfil.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Executa a exclusão do perfil selecionado após confirmação.
     */
    async function deletarPerfil() {
        if (!formulario.id) {
            setModalConfirmacaoExclusaoAberto(false);
            setMensagemResposta("Selecione um perfil válido para exclusão.");
            return;
        }

        setModalConfirmacaoExclusaoAberto(false);
        setCarregando(true);
        setTextoCarregamento("Excluindo perfil...");

        try {
            const resposta = await requisitarAPI(`/api/perfil?id=${formulario.id}`, {
                method: "DELETE",
            });

            const mensagem = typeof resposta.msg === "string"
                ? resposta.msg
                : "Perfil excluído com sucesso.";

            setMensagemResposta(mensagem);
            setFormulario(estadoInicialPerfil);
            aoFechar();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível excluir o perfil.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function fecharModalCadastroPerfil() {
        aoFechar();
    }

    function limparEstadoModalCadastroPerfil() {
        setFormulario({
            ...estadoInicialPerfil,
            permissoes: clonarPermissoes(permissoesIniciais),
        });
        setMensagemResposta("");
        setCarregando(false);
        setModalConfirmacaoExclusaoAberto(false);
    }

    useEffect(() => {
        if (!aberto) {
            return;
        }

        const carregamentoInicial = window.setTimeout(() => {
            if (!idPerfil) {
                setFormulario({
                    ...estadoInicialPerfil,
                    permissoes: clonarPermissoes(permissoesIniciais),
                });
                return;
            }

            void carregarPerfilSelecionado();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [aberto, idPerfil, carregarPerfilSelecionado]);

    return (
        <>
            <Modal
                show={aberto}
                onHide={fecharModalCadastroPerfil}
                onExited={limparEstadoModalCadastroPerfil}
                centered
                size="lg"
                contentClassName="overflow-hidden"
            >
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        {estaEditandoPerfil ? "Perfil" : "Novo perfil"}
                    </Modal.Title>
                </Modal.Header>

                <form onSubmit={salvarPerfil} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <Modal.Body className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
                        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12">
                            <div className="min-w-0 md:col-span-6">
                                <CampoTexto
                                    id="perfil-nome"
                                    label="Nome do perfil"
                                    type="text"
                                    value={formulario.nome}
                                    placeholder="Administrador"
                                    onChange={(event) => atualizarCampoFormulario("nome", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="min-w-0 md:col-span-6">
                                <CampoTexto
                                    id="perfil-descricao"
                                    label="Descrição"
                                    type="text"
                                    value={formulario.descricao}
                                    placeholder="Permissões gerais do perfil"
                                    onChange={(event) => atualizarCampoFormulario("descricao", event.target.value)}
                                    disabled={carregando}
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="min-w-0 md:col-span-12">
                                <div className="flex min-h-10 items-center gap-3">
                                    <input
                                        id="perfil-ativo"
                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        type="checkbox"
                                        checked={formulario.ativo}
                                        disabled={carregando}
                                        onChange={(event) => atualizarCampoFormulario("ativo", event.target.checked)}
                                    />
                                    <label className="break-words text-sm font-semibold text-slate-700" htmlFor="perfil-ativo">
                                        Perfil ativo
                                    </label>
                                </div>
                            </div>

                            <div className="min-w-0 md:col-span-12">
                                <div className="space-y-3 md:hidden">
                                    {recursosPermissao.map((recurso) => (
                                        <fieldset key={recurso.chave} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                                            <legend className="px-1 text-sm font-bold text-slate-900">
                                                {recurso.titulo}
                                            </legend>

                                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {acoesPermissao.map((acao) => (
                                                    <label
                                                        key={`${recurso.chave}-${acao.chave}-mobile`}
                                                        className="flex min-h-10 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                                                        htmlFor={`perfil-${recurso.chave}-${acao.chave}-mobile`}
                                                    >
                                                        <input
                                                            id={`perfil-${recurso.chave}-${acao.chave}-mobile`}
                                                            className="h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                            type="checkbox"
                                                            checked={formulario.permissoes[recurso.chave][acao.chave]}
                                                            disabled={carregando}
                                                            onChange={(event) => atualizarPermissao(
                                                                recurso.chave,
                                                                acao.chave,
                                                                event.target.checked
                                                            )}
                                                        />
                                                        <span className="min-w-0 break-words">{acao.titulo}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                    ))}
                                </div>

                                <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
                                    <table className="w-full min-w-[38rem] border-collapse text-sm">
                                        <thead>
                                            <tr>
                                                <th>Recurso</th>
                                                {acoesPermissao.map((acao) => (
                                                    <th key={acao.chave} className="bg-slate-50 px-3 py-3 text-center text-xs font-bold uppercase text-slate-700">
                                                        {acao.titulo}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recursosPermissao.map((recurso) => (
                                                <tr key={recurso.chave}>
                                                    <td className="border-t border-slate-100 px-3 py-3 font-semibold text-slate-800">{recurso.titulo}</td>
                                                    {acoesPermissao.map((acao) => (
                                                        <td key={`${recurso.chave}-${acao.chave}`} className="border-t border-slate-100 px-3 py-3 text-center">
                                                            <input
                                                                id={`perfil-${recurso.chave}-${acao.chave}`}
                                                                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                                                type="checkbox"
                                                                checked={formulario.permissoes[recurso.chave][acao.chave]}
                                                                disabled={carregando}
                                                                onChange={(event) => atualizarPermissao(
                                                                    recurso.chave,
                                                                    acao.chave,
                                                                    event.target.checked
                                                                )}
                                                                aria-label={`${acao.titulo} ${recurso.titulo}`}
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Modal.Body>

                    <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        {estaEditandoPerfil && (
                            <Botao
                                size="sm"
                                label="Excluir"
                                icon={<FaTrash />}
                                onClick={() => setModalConfirmacaoExclusaoAberto(true)}
                                disabled={carregando}
                                loading={false}
                                variant="outline-danger"
                                type="button"
                                className="w-full sm:mr-auto sm:w-auto"
                            />
                        )}

                        <Botao
                            size="sm"
                            label="Cancelar"
                            icon={<FaTimes />}
                            onClick={fecharModalCadastroPerfil}
                            disabled={carregando}
                            loading={false}
                            variant="outline-secondary"
                            type="button"
                            className="w-full sm:w-auto"
                        />

                        <Botao
                            size="sm"
                            label={estaEditandoPerfil ? "Salvar alterações" : "Salvar perfil"}
                            icon={<FaSave />}
                            onClick={() => undefined}
                            disabled={carregando}
                            loading={carregando}
                            variant="outline-primary"
                            type="submit"
                            className="w-full sm:w-auto"
                        />
                    </Modal.Footer>
                </form>
            </Modal>

            <ModalConfirmacao
                isOpen={aberto && modalConfirmacaoExclusaoAberto}
                message="Deseja realmente excluir este perfil?"
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={deletarPerfil}
                onCancel={() => setModalConfirmacaoExclusaoAberto(false)}
                confirmLabel="Excluir"
                cancelLabel="Cancelar"
            />

            <ModalCarregamento
                show={aberto && carregando}
                text={textoCarregamento}
            />

            <ModalResposta
                isOpen={aberto && Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </>
    );
}
