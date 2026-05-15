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

export type RecursoPermissaoPerfil = "dashboard" | "usuario" | "configuracao" | "perfil";

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
        setFormulario({
            ...estadoInicialPerfil,
            permissoes: clonarPermissoes(permissoesIniciais),
        });
        setMensagemResposta("");
        setCarregando(false);
        setModalConfirmacaoExclusaoAberto(false);
        aoFechar();
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
            <Modal show={aberto} onHide={fecharModalCadastroPerfil} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        {estaEditandoPerfil ? "Perfil" : "Novo perfil"}
                    </Modal.Title>
                </Modal.Header>

                <form onSubmit={salvarPerfil}>
                    <Modal.Body>
                        <div className="grid gap-4 md:grid-cols-12">
                            <div className="md:col-span-6">
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

                            <div className="md:col-span-6">
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

                            <div className="md:col-span-12">
                                <div className="flex items-center gap-3">
                                    <input
                                        id="perfil-ativo"
                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        type="checkbox"
                                        checked={formulario.ativo}
                                        disabled={carregando}
                                        onChange={(event) => atualizarCampoFormulario("ativo", event.target.checked)}
                                    />
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="perfil-ativo">
                                        Perfil ativo
                                    </label>
                                </div>
                            </div>

                            <div className="md:col-span-12">
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
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

                    <Modal.Footer>
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
                                className="mr-auto"
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
                            className=""
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
                            className=""
                        />
                    </Modal.Footer>
                </form>
            </Modal>

            <ModalConfirmacao
                isOpen={modalConfirmacaoExclusaoAberto}
                message="Deseja realmente excluir este perfil?"
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={deletarPerfil}
                onCancel={() => setModalConfirmacaoExclusaoAberto(false)}
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
        </>
    );
}
