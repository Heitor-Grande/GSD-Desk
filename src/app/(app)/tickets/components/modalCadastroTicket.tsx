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
    ativo: boolean;
};

type ProdutoApi = {
    id: number;
    nome: string;
    ativo: boolean;
};

type UsuarioEmpresaApi = {
    usuario_id: number;
    nome: string;
    email: string | null;
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
    fechadoEm: string;
    fechadoPor: OpcaoSeletor | null;
};

type ModalCadastroTicketProps = {
    aberto: boolean;
    aoFechar: () => void;
};

type AbaTicket = "informacoesGerais" | "chat";

const opcoesStatus: OpcaoSeletor[] = [
    { label: "Criando", value: "criando" },
    { label: "Com agente", value: "com_agente" },
    { label: "Com Cliente", value: "com_cliente" },
    { label: "Encerrado Resolvido", value: "encerrado_resolvido" },
    { label: "Encerrado", value: "encerrado" },
    { label: "Não Resolvido", value: "nao_resolvido" },
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
        status: opcoesStatus[0],
        prioridade: opcoesPrioridade[0],
        criadoEm: "",
        atualizadoEm: "",
        fechadoEm: "",
        fechadoPor: null,
    };
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

    const carregarEmpresas = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/empresas", {
                method: "GET",
            });

            const empresas = Array.isArray(resposta.dados) ? resposta.dados as EmpresaApi[] : [];

            setOpcoesEmpresa(empresas.map((empresa) => ({
                label: `${empresa.fantasia}${empresa.ativo ? "" : " (inativa)"}`,
                value: String(empresa.id),
            })));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar as empresas.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    async function carregarDadosEmpresa(empresaSelecionada: OpcaoSeletor | null) {
        atualizarCampoFormulario("empresa", empresaSelecionada);
        setOpcoesProduto([]);
        setOpcoesUsuario([]);
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            empresa: empresaSelecionada,
            produto: null,
            responsavel: null,
            agente: null,
            fechadoPor: null,
        }));

        if (!empresaSelecionada) {
            return;
        }

        setCarregando(true);
        setMensagemResposta("");

        try {
            const [respostaProdutos, respostaUsuarios] = await Promise.all([
                requisitarAPI(`/api/empresas/produtos?empresaId=${empresaSelecionada.value}`, {
                    method: "GET",
                }),
                requisitarAPI(`/api/empresas/usuarios?empresaId=${empresaSelecionada.value}`, {
                    method: "GET",
                }),
            ]);

            const produtos = Array.isArray(respostaProdutos.dados) ? respostaProdutos.dados as ProdutoApi[] : [];
            const usuarios = Array.isArray(respostaUsuarios.dados) ? respostaUsuarios.dados as UsuarioEmpresaApi[] : [];

            setOpcoesProduto(produtos.map((produto) => ({
                label: `${produto.nome}${produto.ativo ? "" : " (inativo)"}`,
                value: String(produto.id),
            })));
            setOpcoesUsuario(usuarios.map((usuario) => ({
                label: `${usuario.nome}${usuario.email ? ` - ${usuario.email}` : ""}`,
                value: String(usuario.usuario_id),
            })));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados da empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function salvarTicket(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const titulo = formulario.titulo.trim();

        if (titulo.length < 5 || titulo.length > 50) {
            setMensagemResposta("O título deve ter entre 5 e 50 caracteres.");
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
                                            void carregarDadosEmpresa(opcao);
                                        }}
                                        placeholder="Selecione a empresa"
                                        isDisabled={carregando}
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
                                        isDisabled={carregando || !formulario.empresa}
                                        isClearable
                                        className="w-full"
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor
                                        id="ticket-agente"
                                        label="Agente"
                                        options={opcoesUsuario}
                                        value={formulario.agente}
                                        onChange={(opcao) => atualizarCampoFormulario("agente", opcao)}
                                        placeholder="Selecione o agente"
                                        isDisabled={carregando || !formulario.empresa}
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
                                        isDisabled={carregando}
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
                                        isDisabled={carregando}
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
                                        options={opcoesUsuario}
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
