"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { Seletor } from "@/components/inputs/select";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaSave, FaTimes } from "react-icons/fa";

type OpcaoSeletor = {
    label: string;
    value: string;
};

type EmpresaApi = {
    id: number;
    fantasia: string;
    empresaPadrao: boolean;
};

type ProdutoApi = {
    id: number;
    nome: string;
};

type UsuarioFormularioApi = {
    id: number;
    nome: string;
    email: string | null;
    ativo?: boolean;
    agenteSuporte?: boolean;
};

type UsuarioAutenticadoApi = {
    id: number;
    nome: string;
    email: string;
    perfilNome: string | null;
    agenteSuporte: boolean;
};

type DadosFormularioTicketApi = {
    usuarioAutenticado: UsuarioAutenticadoApi;
    empresas: EmpresaApi[];
};

type DadosFormularioEmpresaTicketApi = {
    produtos: ProdutoApi[];
    usuariosAtivos: UsuarioFormularioApi[];
    agentesSuporte: UsuarioFormularioApi[];
    usuariosHistorico: UsuarioFormularioApi[];
};

type DadosFormularioTicket = {
    titulo: string;
    empresa: OpcaoSeletor | null;
    produto: OpcaoSeletor | null;
    responsavel: OpcaoSeletor | null;
    agente: OpcaoSeletor | null;
    status: OpcaoSeletor | null;
    prioridade: OpcaoSeletor | null;
    criadoEm: string;
    atualizadoEm: string;
    criadoPor: OpcaoSeletor | null;
    fechadoEm: string;
    fechadoPor: OpcaoSeletor | null;
};

type ModalCadastroTicketProps = {
    aberto: boolean;
    aoFechar: () => void;
};

type AbaTicket = "informacoesGerais" | "chat";

const opcoesStatus: OpcaoSeletor[] = [
    { label: "Com Agente", value: "com_agente" },
    { label: "Com Cliente", value: "com_cliente" },
    { label: "Encerrado Resolvido", value: "encerrado_resolvido" },
    { label: "Encerrado, Não Resolvido", value: "encerrado_nao_resolvido" },
];

const opcoesPrioridade: OpcaoSeletor[] = [
    { label: "Baixa", value: "baixa" },
    { label: "Média", value: "media" },
    { label: "Alta", value: "alta" },
    { label: "Muito alta", value: "muito_alta" },
];

function criarEstadoInicialTicket(): DadosFormularioTicket {
    return {
        titulo: "",
        empresa: null,
        produto: null,
        responsavel: null,
        agente: null,
        status: null,
        prioridade: null,
        criadoEm: "",
        atualizadoEm: "",
        criadoPor: null,
        fechadoEm: "",
        fechadoPor: null,
    };
}

const CHAVE_EMPRESA_NAVEGACAO = "empresaNavegacaoId";

function criarOpcaoUsuario(usuario: UsuarioFormularioApi | UsuarioAutenticadoApi): OpcaoSeletor {
    return {
        label: `${usuario.nome}${usuario.email ? ` - ${usuario.email}` : ""}`,
        value: String(usuario.id),
    };
}

function obterOpcaoUsuarioAutenticado(usuario: UsuarioAutenticadoApi | null): OpcaoSeletor | null {
    return usuario ? criarOpcaoUsuario(usuario) : null;
}

/**
 * Modal local para preenchimento inicial de um novo ticket.
 * Use no menu Tickets enquanto a persistência do fluxo ainda será conectada.
 */
export default function ModalCadastroTicket({
    aberto,
    aoFechar,
}: ModalCadastroTicketProps) {
    const [formulario, setFormulario] = useState<DadosFormularioTicket>(criarEstadoInicialTicket);
    const [opcoesEmpresa, setOpcoesEmpresa] = useState<OpcaoSeletor[]>([]);
    const [opcoesProduto, setOpcoesProduto] = useState<OpcaoSeletor[]>([]);
    const [opcoesUsuario, setOpcoesUsuario] = useState<OpcaoSeletor[]>([]);
    const [opcoesAgente, setOpcoesAgente] = useState<OpcaoSeletor[]>([]);
    const [opcoesUsuarioHistorico, setOpcoesUsuarioHistorico] = useState<OpcaoSeletor[]>([]);
    const [usuarioAutenticado, setUsuarioAutenticado] = useState<UsuarioAutenticadoApi | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [abaAtiva, setAbaAtiva] = useState<AbaTicket>("informacoesGerais");

    function atualizarCampoFormulario(campo: keyof DadosFormularioTicket, valor: string | OpcaoSeletor | null) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    function limparEstadoModalCadastroTicket() {
        setFormulario(criarEstadoInicialTicket());
        setOpcoesProduto([]);
        setOpcoesUsuario([]);
        setOpcoesAgente([]);
        setOpcoesUsuarioHistorico([]);
        setUsuarioAutenticado(null);
        setMensagemResposta("");
        setCarregando(false);
        setAbaAtiva("informacoesGerais");
    }

    function obterClassesAba(aba: AbaTicket): string {
        const classesBase = "rounded-lg px-3 py-2 text-sm font-semibold transition";

        return abaAtiva === aba
            ? `${classesBase} bg-blue-600 text-white shadow-sm`
            : `${classesBase} bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
    }

    const carregarDadosEmpresa = useCallback(async (
        empresaSelecionada: OpcaoSeletor | null,
        usuarioInformado: UsuarioAutenticadoApi | null = null
    ) => {
        atualizarCampoFormulario("empresa", empresaSelecionada);
        setOpcoesProduto([]);
        setOpcoesUsuario([]);
        setOpcoesAgente([]);
        setOpcoesUsuarioHistorico([]);
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            empresa: empresaSelecionada,
            produto: null,
            responsavel: null,
            agente: null,
            criadoPor: null,
            fechadoPor: null,
        }));

        if (!empresaSelecionada) {
            return;
        }

        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI(`/api/tickets/formulario/empresa?empresaId=${empresaSelecionada.value}`, {
                method: "GET",
            });
            const dados = resposta.dados as DadosFormularioEmpresaTicketApi | null;
            const produtos = dados?.produtos ?? [];
            const usuariosAtivos = dados?.usuariosAtivos ?? [];
            const agentesSuporte = dados?.agentesSuporte ?? [];
            const usuariosHistorico = dados?.usuariosHistorico ?? [];
            const opcaoUsuarioLogado = obterOpcaoUsuarioAutenticado(usuarioInformado);

            setOpcoesProduto(produtos.map((produto) => ({
                label: produto.nome,
                value: String(produto.id),
            })));
            setOpcoesUsuario(usuariosAtivos.map(criarOpcaoUsuario));
            setOpcoesAgente(agentesSuporte.map(criarOpcaoUsuario));
            setOpcoesUsuarioHistorico(usuariosHistorico.map((usuario) => ({
                label: `${usuario.nome}${usuario.email ? ` - ${usuario.email}` : ""}${usuario.ativo === false ? " (inativo)" : ""}`,
                value: String(usuario.id),
            })));

            setFormulario((estadoAtual) => ({
                ...estadoAtual,
                responsavel: usuarioInformado?.agenteSuporte ? null : opcaoUsuarioLogado,
                agente: usuarioInformado?.agenteSuporte ? opcaoUsuarioLogado : null,
            }));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados da empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    const carregarEmpresas = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/tickets/formulario", {
                method: "GET",
            });

            const dados = resposta.dados as DadosFormularioTicketApi | null;
            const empresas = dados?.empresas ?? [];
            const usuario = dados?.usuarioAutenticado ?? null;
            const idEmpresaNavegacao = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);

            setUsuarioAutenticado(usuario);

            const novasOpcoesEmpresa = empresas.map((empresa) => ({
                label: empresa.fantasia,
                value: String(empresa.id),
            }));
            const empresaInicial = empresas.find((empresa) => String(empresa.id) === idEmpresaNavegacao)
                ?? empresas.find((empresa) => empresa.empresaPadrao)
                ?? empresas[0];
            const opcaoEmpresaInicial = empresaInicial
                ? {
                    label: empresaInicial.fantasia,
                    value: String(empresaInicial.id),
                }
                : null;

            setOpcoesEmpresa(novasOpcoesEmpresa);

            if (opcaoEmpresaInicial) {
                await carregarDadosEmpresa(opcaoEmpresaInicial, usuario);
            }
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar as empresas.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [carregarDadosEmpresa]);

    function salvarTicket(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const titulo = formulario.titulo.trim();

        if (titulo.length < 5 || titulo.length > 50) {
            setMensagemResposta("O título deve ter entre 5 e 50 caracteres.");
            return;
        }

        if (!formulario.empresa || !formulario.produto || !formulario.responsavel) {
            setMensagemResposta("Informe empresa, produto e responsável para criar o ticket.");
            return;
        }

        if (usuarioAutenticado?.agenteSuporte && (!formulario.status || !formulario.prioridade)) {
            setMensagemResposta("Informe status e prioridade para criar o ticket.");
            return;
        }

        aoFechar();
    }

    useEffect(() => {
        if (!aberto) {
            return;
        }

        const carregamentoInicial = window.setTimeout(() => {
            void carregarEmpresas();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [aberto, carregarEmpresas]);

    return (
        <>
            <Modal
                show={aberto}
                onHide={aoFechar}
                onExited={limparEstadoModalCadastroTicket}
                centered
                size="xl"
            >
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        Novo ticket
                    </Modal.Title>
                </Modal.Header>

                <form id="formulario-cadastro-ticket" onSubmit={salvarTicket}>
                    <Modal.Body>
                        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                            <button
                                type="button"
                                className={obterClassesAba("informacoesGerais")}
                                onClick={() => setAbaAtiva("informacoesGerais")}
                            >
                                Informações Gerais
                            </button>
                            <button
                                type="button"
                                className={obterClassesAba("chat")}
                                onClick={() => setAbaAtiva("chat")}
                            >
                                Chat
                            </button>
                        </div>

                        {abaAtiva === "informacoesGerais" && (
                            <div className="grid gap-4 md:grid-cols-12">
                                <div className="md:col-span-12">
                                    <CampoTexto
                                        id="ticket-titulo"
                                        label="Título"
                                        type="text"
                                        value={formulario.titulo}
                                        placeholder="Informe o título do ticket"
                                        onChange={(event) => atualizarCampoFormulario("titulo", event.target.value)}
                                        disabled={carregando}
                                        required
                                        className="mb-0"
                                        helpText="Entre 5 e 50 caracteres."
                                        maxLength={50}
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-empresa"
                                        label="Empresa"
                                        options={opcoesEmpresa}
                                        value={formulario.empresa}
                                        onChange={(opcao) => {
                                            void carregarDadosEmpresa(opcao, usuarioAutenticado);
                                        }}
                                        placeholder="Selecione a empresa"
                                        isDisabled
                                        isClearable
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-produto"
                                        label="Produto"
                                        options={opcoesProduto}
                                        value={formulario.produto}
                                        onChange={(opcao) => atualizarCampoFormulario("produto", opcao)}
                                        placeholder="Selecione o produto"
                                        isDisabled={carregando || !formulario.empresa}
                                        isClearable
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-responsavel"
                                        label="Responsável"
                                        options={opcoesUsuario}
                                        value={formulario.responsavel}
                                        onChange={(opcao) => atualizarCampoFormulario("responsavel", opcao)}
                                        placeholder="Selecione o responsável"
                                        isDisabled={carregando || !formulario.empresa || !usuarioAutenticado?.agenteSuporte}
                                        isClearable
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-agente"
                                        label="Agente"
                                        options={opcoesAgente}
                                        value={formulario.agente}
                                        onChange={(opcao) => atualizarCampoFormulario("agente", opcao)}
                                        placeholder="Selecione o agente"
                                        isDisabled
                                        isClearable
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-status"
                                        label="Status"
                                        options={opcoesStatus}
                                        value={formulario.status}
                                        onChange={(opcao) => atualizarCampoFormulario("status", opcao)}
                                        placeholder="Selecione o status"
                                        isDisabled
                                        isClearable={false}
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-prioridade"
                                        label="Prioridade"
                                        options={opcoesPrioridade}
                                        value={formulario.prioridade}
                                        onChange={(opcao) => atualizarCampoFormulario("prioridade", opcao)}
                                        placeholder="Selecione a prioridade"
                                        isDisabled={carregando || !usuarioAutenticado?.agenteSuporte}
                                        isClearable={false}
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <CampoTexto
                                        id="ticket-criado-em"
                                        label="Criado em"
                                        type="datetime-local"
                                        value={formulario.criadoEm}
                                        placeholder=""
                                        onChange={() => undefined}
                                        disabled
                                        required={false}
                                        className="mb-0"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <Seletor
                                        id="ticket-criado-por"
                                        label="Criado por"
                                        options={opcoesUsuarioHistorico}
                                        value={formulario.criadoPor}
                                        onChange={(opcao) => atualizarCampoFormulario("criadoPor", opcao)}
                                        placeholder=""
                                        isDisabled
                                        isClearable
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <CampoTexto
                                        id="ticket-atualizado-em"
                                        label="Última atualização em"
                                        type="datetime-local"
                                        value={formulario.atualizadoEm}
                                        placeholder=""
                                        onChange={() => undefined}
                                        disabled
                                        required={false}
                                        className="mb-0"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <CampoTexto
                                        id="ticket-fechado-em"
                                        label="Fechado em"
                                        type="datetime-local"
                                        value={formulario.fechadoEm}
                                        placeholder=""
                                        onChange={() => undefined}
                                        disabled
                                        required={false}
                                        className="mb-0"
                                    />
                                </div>

                                <div className="md:col-span-3">
                                    <Seletor
                                        id="ticket-fechado-por"
                                        label="Fechado por"
                                        options={opcoesUsuarioHistorico}
                                        value={formulario.fechadoPor}
                                        onChange={(opcao) => atualizarCampoFormulario("fechadoPor", opcao)}
                                        placeholder="Selecione quem fechou"
                                        isDisabled
                                        isClearable
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {abaAtiva === "chat" && (
                            <div className="flex min-h-[22rem] flex-col rounded-lg border border-slate-200 bg-slate-50">
                                <div className="flex-1 p-4">
                                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                                        Nenhuma mensagem registrada para este ticket.
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 bg-white p-4">
                                    <label className="block text-sm font-semibold text-slate-700" htmlFor="ticket-chat-mensagem">
                                        Mensagem
                                    </label>
                                    <textarea
                                        id="ticket-chat-mensagem"
                                        className="mt-1 min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                                        placeholder="Digite uma mensagem"
                                        disabled={carregando}
                                    />
                                </div>
                            </div>
                        )}
                    </Modal.Body>

                    <Modal.Footer>
                        <Botao
                            size="sm"
                            label="Cancelar"
                            icon={<FaTimes />}
                            onClick={aoFechar}
                            disabled={carregando}
                            loading={false}
                            variant="outline-secondary"
                            type="button"
                            className=""
                        />

                        <Botao
                            size="sm"
                            label="Salvar ticket"
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

            <ModalCarregamento
                show={aberto && carregando}
                text="Carregando dados do ticket..."
            />

            <ModalResposta
                isOpen={aberto && Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </>
    );
}
