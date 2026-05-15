"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { Seletor } from "@/components/inputs/select";
import ModalConfirmacao from "@/components/modals/confirmModal";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { ColunaTabelaDados, TabelaDados } from "@/components/tables/dataTable";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaExclamationTriangle, FaLink, FaSave, FaTimes, FaTrash } from "react-icons/fa";

type AbaEmpresa = "dados" | "usuarios";

type EmpresaDetalhada = {
    id: number;
    fantasia: string;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    ativo: boolean;
    criado_em: string;
    atualizado_em: string;
};

type FormularioEmpresa = {
    id: number | null;
    fantasia: string;
    cnpj: string;
    email: string;
    telefone: string;
    ativo: boolean;
    criadoEm: string;
    atualizadoEm: string;
};

type UsuarioVinculado = {
    [key: string]: unknown;
    id: number;
    usuario_id: number;
    empresa_id: number;
    nome: string;
    email: string;
    ativo: boolean;
    criado_em: string;
};

type UsuarioDisponivel = {
    id: number;
    nome: string;
    email: string;
    ativo: boolean;
};

type OpcaoUsuario = {
    label: string;
    value: string;
};

interface ModalCadastroEmpresaProps {
    aberto: boolean;
    idEmpresa?: number | null;
    aoFechar: () => void;
}

const formularioInicial: FormularioEmpresa = {
    id: null,
    fantasia: "",
    cnpj: "",
    email: "",
    telefone: "",
    ativo: true,
    criadoEm: "",
    atualizadoEm: "",
};

function formatarCnpj(valor: string): string {
    const digitos = valor.replace(/\D/g, "").slice(0, 14);

    return digitos
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatarDataHoraFormulario(valor: string): string {
    if (!valor) {
        return "";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(valor));
}

function mapearEmpresaParaFormulario(empresa: EmpresaDetalhada): FormularioEmpresa {
    return {
        id: empresa.id,
        fantasia: empresa.fantasia,
        cnpj: formatarCnpj(empresa.cnpj),
        email: empresa.email || "",
        telefone: empresa.telefone || "",
        ativo: empresa.ativo,
        criadoEm: formatarDataHoraFormulario(empresa.criado_em),
        atualizadoEm: formatarDataHoraFormulario(empresa.atualizado_em),
    };
}

/**
 * Modal local de cadastro e visualização de empresa.
 * Use no fluxo de empresas para cadastrar, editar, excluir e gerenciar usuários vinculados.
 */
export default function ModalCadastroEmpresa({
    aberto,
    idEmpresa,
    aoFechar,
}: ModalCadastroEmpresaProps) {
    const [abaAtiva, setAbaAtiva] = useState<AbaEmpresa>("dados");
    const [formulario, setFormulario] = useState<FormularioEmpresa>(formularioInicial);
    const [usuariosVinculados, setUsuariosVinculados] = useState<UsuarioVinculado[]>([]);
    const [opcoesUsuarios, setOpcoesUsuarios] = useState<OpcaoUsuario[]>([]);
    const [usuarioSelecionado, setUsuarioSelecionado] = useState<OpcaoUsuario | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Processando solicitação...");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalConfirmacaoExclusaoAberto, setModalConfirmacaoExclusaoAberto] = useState(false);

    const estaVisualizandoEmpresa = typeof idEmpresa === "number" && idEmpresa > 0;
    const empresaSelecionada = typeof formulario.id === "number" && formulario.id > 0;

    const colunasUsuarios: ColunaTabelaDados<UsuarioVinculado>[] = [
        { chave: "nome", titulo: "Usuário" },
        { chave: "email", titulo: "E-mail" },
        {
            chave: "ativo",
            titulo: "Status",
            renderizar: (usuario) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${usuario.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {usuario.ativo ? "Ativo" : "Inativo"}
                </span>
            ),
        },
        {
            chave: "id",
            titulo: "Ações",
            alinhamento: "end",
            renderizar: (usuario) => (
                <button
                    type="button"
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:border-red-700 hover:bg-red-700 hover:text-white"
                    onClick={(event) => {
                        event.stopPropagation();
                        void removerVinculoUsuario(usuario.id);
                    }}
                    disabled={carregando}
                >
                    <FaTrash className="mr-2" />
                    Remover
                </button>
            ),
        },
    ];

    function atualizarCampoFormulario(campo: keyof FormularioEmpresa, valor: string | boolean) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    /**
     * Carrega os dados da empresa selecionada para preencher o formulário.
     */
    const carregarEmpresaSelecionada = useCallback(async () => {
        if (!idEmpresa) {
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Carregando empresa...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI(`/api/empresas?id=${idEmpresa}`, {
                method: "GET",
            });

            const empresa = resposta.dados as EmpresaDetalhada | null;

            if (!empresa) {
                setMensagemResposta("Não foi possível carregar os dados da empresa.");
                return;
            }

            setFormulario(mapearEmpresaParaFormulario(empresa));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados da empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [idEmpresa]);

    /**
     * Carrega usuários vinculados e disponíveis para vínculo com a empresa.
     */
    const carregarUsuariosEmpresa = useCallback(async (empresaId: number) => {
        setCarregando(true);
        setTextoCarregamento("Carregando usuários da empresa...");
        setMensagemResposta("");

        try {
            const [respostaVinculados, respostaDisponiveis] = await Promise.all([
                requisitarAPI(`/api/empresas/usuarios?empresaId=${empresaId}`, {
                    method: "GET",
                }),
                requisitarAPI(`/api/empresas/usuarios?empresaId=${empresaId}&disponiveis=true`, {
                    method: "GET",
                }),
            ]);

            const vinculados = Array.isArray(respostaVinculados.dados)
                ? respostaVinculados.dados as UsuarioVinculado[]
                : [];
            const disponiveis = Array.isArray(respostaDisponiveis.dados)
                ? respostaDisponiveis.dados as UsuarioDisponivel[]
                : [];

            setUsuariosVinculados(vinculados);
            setOpcoesUsuarios(disponiveis.map((usuario) => ({
                label: `${usuario.nome} (${usuario.email})`,
                value: String(usuario.id),
            })));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os usuários da empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    /**
     * Salva a empresa usando a mesma tela para criação e edição.
     */
    async function salvarEmpresa(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCarregando(true);
        setTextoCarregamento(empresaSelecionada ? "Atualizando empresa..." : "Cadastrando empresa...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/empresas", {
                method: empresaSelecionada ? "PUT" : "POST",
                body: {
                    id: formulario.id,
                    fantasia: formulario.fantasia,
                    cnpj: formulario.cnpj,
                    email: formulario.email,
                    telefone: formulario.telefone,
                    ativo: formulario.ativo,
                },
            });

            const empresaSalva = resposta.dados as EmpresaDetalhada | null;

            if (empresaSalva?.id) {
                setFormulario(mapearEmpresaParaFormulario(empresaSalva));
            }

            setMensagemResposta(typeof resposta.msg === "string" ? resposta.msg : "Empresa salva com sucesso.");
            aoFechar();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível salvar a empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Exclui a empresa selecionada após confirmação.
     */
    async function excluirEmpresa() {
        if (!formulario.id) {
            setModalConfirmacaoExclusaoAberto(false);
            setMensagemResposta("Selecione uma empresa válida para exclusão.");
            return;
        }

        setModalConfirmacaoExclusaoAberto(false);
        setCarregando(true);
        setTextoCarregamento("Excluindo empresa...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI(`/api/empresas?id=${formulario.id}`, {
                method: "DELETE",
            });

            setMensagemResposta(typeof resposta.msg === "string" ? resposta.msg : "Empresa excluída com sucesso.");
            aoFechar();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível excluir a empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Vincula um usuário existente à empresa selecionada.
     */
    async function vincularUsuarioEmpresa() {
        if (!formulario.id || !usuarioSelecionado) {
            setMensagemResposta("Selecione uma empresa e um usuário para criar o vínculo.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Vinculando usuário...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/empresas/usuarios", {
                method: "POST",
                body: {
                    empresaId: formulario.id,
                    usuarioId: usuarioSelecionado.value,
                },
            });

            setUsuarioSelecionado(null);
            setMensagemResposta(typeof resposta.msg === "string" ? resposta.msg : "Usuário vinculado com sucesso.");
            await carregarUsuariosEmpresa(formulario.id);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível vincular o usuário.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Remove o vínculo entre usuário e empresa sem excluir o usuário.
     */
    async function removerVinculoUsuario(idVinculo: number) {
        if (!formulario.id) {
            setMensagemResposta("Selecione uma empresa válida para remover o vínculo.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Removendo vínculo...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI(`/api/empresas/usuarios?id=${idVinculo}`, {
                method: "DELETE",
            });

            setMensagemResposta(typeof resposta.msg === "string" ? resposta.msg : "Vínculo removido com sucesso.");
            await carregarUsuariosEmpresa(formulario.id);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível remover o vínculo.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Fecha o modal e limpa o estado local para uma nova abertura.
     */
    function fecharModalCadastroEmpresa() {
        setAbaAtiva("dados");
        setFormulario(formularioInicial);
        setUsuariosVinculados([]);
        setOpcoesUsuarios([]);
        setUsuarioSelecionado(null);
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
            setAbaAtiva("dados");
            setUsuariosVinculados([]);
            setOpcoesUsuarios([]);
            setUsuarioSelecionado(null);

            if (!idEmpresa) {
                setFormulario(formularioInicial);
                return;
            }

            void carregarEmpresaSelecionada();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [aberto, idEmpresa, carregarEmpresaSelecionada]);

    useEffect(() => {
        if (!aberto || abaAtiva !== "usuarios" || !formulario.id) {
            return;
        }

        const carregamentoUsuarios = window.setTimeout(() => {
            void carregarUsuariosEmpresa(formulario.id as number);
        }, 0);

        return () => window.clearTimeout(carregamentoUsuarios);
    }, [abaAtiva, aberto, carregarUsuariosEmpresa, formulario.id]);

    return (
        <>
            <Modal show={aberto} onHide={fecharModalCadastroEmpresa} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        {estaVisualizandoEmpresa ? "Empresa" : "Nova empresa"}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                        <button
                            type="button"
                            className={`rounded-md px-3 py-2 text-sm font-bold transition ${abaAtiva === "dados" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                            onClick={() => setAbaAtiva("dados")}
                        >
                            Dados da empresa
                        </button>
                        <button
                            type="button"
                            className={`rounded-md px-3 py-2 text-sm font-bold transition ${abaAtiva === "usuarios" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"} disabled:cursor-not-allowed disabled:opacity-60`}
                            onClick={() => setAbaAtiva("usuarios")}
                            disabled={!empresaSelecionada}
                        >
                            Usuários vinculados
                        </button>
                    </div>

                    {abaAtiva === "dados" && (
                        <form id="formulario-cadastro-empresa" onSubmit={salvarEmpresa}>
                            <div className="grid gap-4 md:grid-cols-12">
                                <div className="md:col-span-6">
                                    <CampoTexto
                                        id="empresa-fantasia"
                                        label="Nome"
                                        type="text"
                                        value={formulario.fantasia}
                                        placeholder="Nome fantasia da empresa"
                                        onChange={(event) => atualizarCampoFormulario("fantasia", event.target.value)}
                                        disabled={carregando}
                                        required
                                        className="mb-0"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <CampoTexto
                                        id="empresa-cnpj"
                                        label="CNPJ"
                                        type="text"
                                        value={formulario.cnpj}
                                        placeholder="00.000.000/0000-00"
                                        onChange={(event) => atualizarCampoFormulario("cnpj", formatarCnpj(event.target.value))}
                                        disabled={carregando}
                                        required
                                        className="mb-0"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <CampoTexto
                                        id="empresa-email"
                                        label="E-mail"
                                        type="email"
                                        value={formulario.email}
                                        placeholder="contato@empresa.com"
                                        onChange={(event) => atualizarCampoFormulario("email", event.target.value)}
                                        disabled={carregando}
                                        required={false}
                                        className="mb-0"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <CampoTexto
                                        id="empresa-telefone"
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

                                <div className="md:col-span-4">
                                    <div className="mt-7 flex items-center gap-3">
                                        <input
                                            id="empresa-ativo"
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                            type="checkbox"
                                            checked={formulario.ativo}
                                            disabled={carregando}
                                            onChange={(event) => atualizarCampoFormulario("ativo", event.target.checked)}
                                        />
                                        <label className="text-sm font-semibold text-slate-700" htmlFor="empresa-ativo">
                                            Empresa ativa
                                        </label>
                                    </div>
                                </div>

                                <div className="md:col-span-4">
                                    <CampoTexto
                                        id="empresa-criado-em"
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

                                <div className="md:col-span-4">
                                    <CampoTexto
                                        id="empresa-atualizado-em"
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
                            </div>
                        </form>
                    )}

                    {abaAtiva === "usuarios" && (
                        <div>
                            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                                Vincule apenas usuários já cadastrados no sistema. Para criar um novo usuário, use o módulo de usuários.
                            </div>

                            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                                <Seletor
                                    id="empresa-usuario-vinculo"
                                    label="Usuário"
                                    options={opcoesUsuarios}
                                    value={usuarioSelecionado}
                                    onChange={setUsuarioSelecionado}
                                    placeholder="Selecione um usuário"
                                    isDisabled={carregando || !empresaSelecionada}
                                    isClearable
                                    className="mb-0"
                                />

                                <Botao
                                    size="sm"
                                    label="Vincular"
                                    icon={<FaLink />}
                                    onClick={vincularUsuarioEmpresa}
                                    disabled={carregando || !usuarioSelecionado}
                                    loading={false}
                                    variant="outline-primary"
                                    type="button"
                                    className="min-h-10"
                                />
                            </div>

                            <TabelaDados
                                colunas={colunasUsuarios}
                                dados={usuariosVinculados}
                                carregando={carregando}
                                mensagemSemDados="Nenhum usuário vinculado a esta empresa."
                                placeholderFiltro="Procurar usuário vinculado"
                            />
                        </div>
                    )}
                </Modal.Body>

                <Modal.Footer>
                    {estaVisualizandoEmpresa && abaAtiva === "dados" && (
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
                        onClick={fecharModalCadastroEmpresa}
                        disabled={carregando}
                        loading={false}
                        variant="outline-secondary"
                        type="button"
                        className=""
                    />

                    {abaAtiva === "dados" && (
                        <Botao
                            size="sm"
                            label={estaVisualizandoEmpresa ? "Salvar alterações" : "Salvar empresa"}
                            icon={<FaSave />}
                            onClick={() => undefined}
                            disabled={carregando}
                            loading={carregando}
                            variant="outline-primary"
                            type="submit"
                            className=""
                            form="formulario-cadastro-empresa"
                        />
                    )}
                </Modal.Footer>
            </Modal>

            <ModalConfirmacao
                isOpen={modalConfirmacaoExclusaoAberto}
                message="Deseja realmente excluir esta empresa? Os vínculos com usuários também serão removidos."
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={excluirEmpresa}
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
