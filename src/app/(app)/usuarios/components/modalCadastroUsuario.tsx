"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { Seletor } from "@/components/inputs/select";
import ModalConfirmacao from "@/components/modals/confirmModal";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaExclamationTriangle, FaSave, FaTimes, FaTrash } from "react-icons/fa";

type OpcaoPerfil = {
    label: string;
    value: string;
};

type DadosCadastroUsuario = {
    id: number | null;
    nome: string;
    email: string;
    telefone: string;
    documento: string;
    perfil: OpcaoPerfil | null;
    ativo: boolean;
    isAdmin: boolean;
    criadoEm: string;
    atualizadoEm: string;
    senha: string;
    confirmarSenha: string;
};

type UsuarioDetalhadoApi = {
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    documento: string | null;
    perfil_id: number | null;
    perfil_nome: string | null;
    ativo: boolean;
    isAdmin: boolean;
    criado_em: string;
    atualizado_em: string;
};

type PerfilApi = {
    id: number;
    nome: string;
    ativo: boolean;
};

interface ModalCadastroUsuarioProps {
    aberto: boolean;
    idUsuario?: number | null;
    aoFechar: () => void;
}

const estadoInicialFormulario: DadosCadastroUsuario = {
    id: null,
    nome: "",
    email: "",
    telefone: "",
    documento: "",
    perfil: null,
    ativo: true,
    isAdmin: false,
    criadoEm: "",
    atualizadoEm: "",
    senha: "",
    confirmarSenha: "",
};

function formatarDataHoraFormulario(valor: string): string {
    if (!valor) {
        return "";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(valor));
}

function mapearUsuarioParaFormulario(usuario: UsuarioDetalhadoApi): DadosCadastroUsuario {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone || "",
        documento: usuario.documento || "",
        perfil: usuario.perfil_id
            ? {
                label: usuario.perfil_nome || "Perfil vinculado",
                value: String(usuario.perfil_id),
            }
            : null,
        ativo: usuario.ativo,
        isAdmin: usuario.isAdmin,
        criadoEm: formatarDataHoraFormulario(usuario.criado_em),
        atualizadoEm: formatarDataHoraFormulario(usuario.atualizado_em),
        senha: "",
        confirmarSenha: "",
    };
}

/**
 * Modal local de cadastro e visualização de usuário.
 * Use no fluxo de usuários para cadastrar novos registros, editar dados e vincular um perfil.
 */
export default function ModalCadastroUsuario({
    aberto,
    idUsuario,
    aoFechar,
}: ModalCadastroUsuarioProps) {
    const [formulario, setFormulario] = useState<DadosCadastroUsuario>(estadoInicialFormulario);
    const [opcoesPerfil, setOpcoesPerfil] = useState<OpcaoPerfil[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Processando solicitação...");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalConfirmacaoExclusaoAberto, setModalConfirmacaoExclusaoAberto] = useState(false);

    const estaVisualizandoUsuario = typeof idUsuario === "number" && idUsuario > 0;

    function atualizarCampoFormulario(campo: keyof DadosCadastroUsuario, valor: string | boolean | number | OpcaoPerfil | null) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    /**
     * Carrega os perfis ativos para preencher o seletor de vínculo do usuário.
     */
    const carregarPerfisDisponiveis = useCallback(async () => {
        try {
            const resposta = await requisitarAPI("/api/perfil", {
                method: "GET",
            });

            const perfis = Array.isArray(resposta.dados) ? resposta.dados as PerfilApi[] : [];

            setOpcoesPerfil(perfis
                .filter((perfil) => perfil.ativo)
                .map((perfil) => ({
                    label: perfil.nome,
                    value: String(perfil.id),
                })));
        } catch {
            setMensagemResposta("Não foi possível carregar os perfis disponíveis.");
        }
    }, []);

    /**
     * Carrega os dados do usuário selecionado para preencher o formulário.
     */
    const carregarUsuarioSelecionado = useCallback(async () => {
        if (!idUsuario) {
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Carregando usuário...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI(`/api/usuarios?id=${idUsuario}`, {
                method: "GET",
            });

            const usuario = resposta.dados as UsuarioDetalhadoApi | null;

            if (!usuario) {
                setMensagemResposta("Não foi possível carregar os dados do usuário.");
                return;
            }

            setFormulario(mapearUsuarioParaFormulario(usuario));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados do usuário.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [idUsuario]);

    /**
     * Executa a regra de cadastro ou edição do usuário dentro do próprio modal.
     */
    async function cadastrarUsuario(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMensagemResposta("");

        if (formulario.senha !== formulario.confirmarSenha) {
            setMensagemResposta("As senhas informadas não conferem.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento(estaVisualizandoUsuario ? "Atualizando usuário..." : "Cadastrando usuário...");

        try {
            const resposta = await requisitarAPI("/api/usuarios", {
                method: estaVisualizandoUsuario ? "PUT" : "POST",
                body: {
                    id: formulario.id,
                    nome: formulario.nome,
                    email: formulario.email,
                    telefone: formulario.telefone,
                    documento: formulario.documento,
                    perfilId: formulario.perfil?.value ?? null,
                    ativo: formulario.ativo,
                    isAdmin: formulario.isAdmin,
                    senha: formulario.senha,
                    confirmarSenha: formulario.confirmarSenha,
                },
            });

            const mensagem = typeof resposta.msg === "string"
                ? resposta.msg
                : "Não foi possível salvar o usuário.";

            setMensagemResposta(mensagem);
            setFormulario(estadoInicialFormulario);
            aoFechar();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível conectar ao servidor.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Executa a exclusão do usuário selecionado após confirmação.
     */
    async function deletarUsuario() {
        if (!formulario.id) {
            setModalConfirmacaoExclusaoAberto(false);
            setMensagemResposta("Selecione um usuário válido para exclusão.");
            return;
        }

        setModalConfirmacaoExclusaoAberto(false);
        setCarregando(true);
        setTextoCarregamento("Excluindo usuário...");

        try {
            const resposta = await requisitarAPI(`/api/usuarios?id=${formulario.id}`, {
                method: "DELETE",
            });

            const mensagem = typeof resposta.msg === "string"
                ? resposta.msg
                : "Usuário excluído com sucesso.";

            setMensagemResposta(mensagem);
            setFormulario(estadoInicialFormulario);
            aoFechar();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível excluir o usuário.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Fecha o modal e limpa o formulário para uma nova inclusão.
     */
    function fecharModalCadastroUsuario() {
        setFormulario(estadoInicialFormulario);
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
            void carregarPerfisDisponiveis();

            if (!idUsuario) {
                setFormulario(estadoInicialFormulario);
                return;
            }

            void carregarUsuarioSelecionado();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [aberto, idUsuario, carregarUsuarioSelecionado, carregarPerfisDisponiveis]);

    return (
        <>
            <Modal show={aberto} onHide={fecharModalCadastroUsuario} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        {estaVisualizandoUsuario ? "Usuário" : "Novo usuário"}
                    </Modal.Title>
                </Modal.Header>

                <form onSubmit={cadastrarUsuario}>
                    <Modal.Body>
                        <div className="grid gap-4 md:grid-cols-12">
                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-nome"
                                    label="Nome"
                                    type="text"
                                    value={formulario.nome}
                                    placeholder="Nome completo"
                                    onChange={(event) => atualizarCampoFormulario("nome", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-email"
                                    label="E-mail"
                                    type="email"
                                    value={formulario.email}
                                    placeholder="usuario@empresa.com"
                                    onChange={(event) => atualizarCampoFormulario("email", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-telefone"
                                    label="Telefone"
                                    type="tel"
                                    value={formulario.telefone}
                                    placeholder="(00) 00000-0000"
                                    onChange={(event) => atualizarCampoFormulario("telefone", event.target.value)}
                                    disabled={carregando}
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-documento"
                                    label="Documento"
                                    type="text"
                                    value={formulario.documento}
                                    placeholder="CPF ou CNPJ"
                                    onChange={(event) => atualizarCampoFormulario("documento", event.target.value)}
                                    disabled={carregando}
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <Seletor
                                    id="usuario-perfil"
                                    label="Perfil"
                                    options={opcoesPerfil}
                                    value={formulario.perfil}
                                    onChange={(opcao) => atualizarCampoFormulario("perfil", opcao)}
                                    placeholder="Selecione o perfil"
                                    isDisabled={carregando}
                                    isClearable
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-3">
                                <div className="mt-7 flex items-center gap-3">
                                    <input
                                        id="usuario-ativo"
                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        type="checkbox"
                                        checked={formulario.ativo}
                                        disabled={carregando}
                                        onChange={(event) => atualizarCampoFormulario("ativo", event.target.checked)}
                                    />
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="usuario-ativo">
                                        Usuário ativo
                                    </label>
                                </div>
                            </div>

                            <div className="md:col-span-3">
                                <div className="mt-7 flex items-center gap-3">
                                    <input
                                        id="usuario-admin"
                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        type="checkbox"
                                        checked={formulario.isAdmin}
                                        disabled={carregando}
                                        onChange={(event) => atualizarCampoFormulario("isAdmin", event.target.checked)}
                                    />
                                    <label className="text-sm font-semibold text-slate-700" htmlFor="usuario-admin">
                                        Administrador
                                    </label>
                                </div>
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-criado-em"
                                    label="Criado em"
                                    type="text"
                                    value={formulario.criadoEm}
                                    placeholder="Gerado automaticamente"
                                    onChange={() => undefined}
                                    disabled
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-atualizado-em"
                                    label="Atualizado em"
                                    type="text"
                                    value={formulario.atualizadoEm}
                                    placeholder="Gerado automaticamente"
                                    onChange={() => undefined}
                                    disabled
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-senha"
                                    label={estaVisualizandoUsuario ? "Nova senha" : "Senha"}
                                    type="password"
                                    value={formulario.senha}
                                    placeholder={estaVisualizandoUsuario ? "Digite uma nova senha" : "Senha inicial"}
                                    onChange={(event) => atualizarCampoFormulario("senha", event.target.value)}
                                    disabled={carregando}
                                    required={!estaVisualizandoUsuario}
                                    className="mb-0"
                                    helpText="A senha deve ter pelo menos 6 caracteres."
                                    classNameHelpText="mt-1 block text-sm text-slate-500"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="usuario-confirmar-senha"
                                    label={estaVisualizandoUsuario ? "Confirmar nova senha" : "Confirmar senha"}
                                    type="password"
                                    value={formulario.confirmarSenha}
                                    placeholder={estaVisualizandoUsuario ? "Repita a nova senha" : "Repita a senha inicial"}
                                    onChange={(event) => atualizarCampoFormulario("confirmarSenha", event.target.value)}
                                    disabled={carregando}
                                    required={!estaVisualizandoUsuario}
                                    className="mb-0"
                                />
                            </div>
                        </div>
                    </Modal.Body>

                    <Modal.Footer>
                        {estaVisualizandoUsuario && (
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
                            onClick={fecharModalCadastroUsuario}
                            disabled={carregando}
                            loading={false}
                            variant="outline-secondary"
                            type="button"
                            className=""
                        />

                        <Botao
                            size="sm"
                            label={estaVisualizandoUsuario ? "Salvar alterações" : "Salvar usuário"}
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
                message="Deseja realmente excluir este usuário?"
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={deletarUsuario}
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
