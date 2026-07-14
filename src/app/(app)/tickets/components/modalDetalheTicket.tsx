"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { Seletor } from "@/components/inputs/select";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaPaperPlane, FaSave, FaTimes } from "react-icons/fa";

type OpcaoSeletor = {
    label: string;
    value: string;
};

type UsuarioFormularioApi = {
    id: number;
    nome: string;
    email: string | null;
    ativo?: boolean;
};

type DadosFormularioEmpresaTicketApi = {
    usuariosAtivos: UsuarioFormularioApi[];
    agentesSuporte: UsuarioFormularioApi[];
};

type TicketDetalhadoApi = {
    id: number;
    titulo: string;
    empresa_id: number;
    produto_id: number;
    responsavel_id: number;
    agente_id: number | null;
    empresa_nome: string;
    produto_nome: string;
    responsavel_nome: string;
    agente_nome: string | null;
    status: string;
    prioridade: string;
    criado_em: string;
    criado_por: number;
    criado_por_nome: string;
    ultima_atualizacao_em: string;
    fechado_em: string | null;
    fechado_por: number | null;
    fechado_por_nome: string | null;
    usuario_logado_id?: number;
    usuario_pode_editar_informacoes_gerais?: boolean;
    usuario_pode_editar_responsavel?: boolean;
    usuario_pode_editar_status?: boolean;
    usuario_pode_editar_agente?: boolean;
    usuario_pode_editar_prioridade?: boolean;
};

type MensagemTicketApi = {
    id: number;
    conteudo: string;
    enviado_por: number;
    enviado_por_nome: string;
    enviado_em: string;
    anexos?: AnexoMensagemTicketApi[];
};

type AnexoMensagemTicketApi = {
    id: number;
    nome_original: string;
};

type DadosDetalheTicketApi = {
    ticket: TicketDetalhadoApi;
    mensagens: MensagemTicketApi[];
};

type FormularioDetalheTicket = {
    titulo: string;
    empresa: OpcaoSeletor | null;
    produto: OpcaoSeletor | null;
    responsavel: OpcaoSeletor | null;
    agente: OpcaoSeletor | null;
    status: OpcaoSeletor | null;
    prioridade: OpcaoSeletor | null;
    criadoEm: string;
    criadoPor: string;
    atualizadoEm: string;
    fechadoEm: string;
    fechadoPor: string;
};

type ModalDetalheTicketProps = {
    aberto: boolean;
    idTicket: number;
    aoFechar: () => void;
};

type AbaTicket = "informacoesGerais" | "chat";

type ConfirmacaoAtualizacaoStatus = {
    mensagem: string;
};

type EditorMensagemTicketProps = {
    id: string;
    value: string;
    disabled: boolean;
    onChange: (html: string, texto: string) => void;
};

const CHAVE_EMPRESA_NAVEGACAO = "empresaNavegacaoId";
const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;
const TIPOS_ANEXO_PERMITIDOS = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const STATUS_TICKET_ENCERRADO = new Set(["encerrado_resolvido", "encerrado_nao_resolvido"]);

const opcoesStatus: OpcaoSeletor[] = [
    { label: "Pendente vínculo agente", value: "pendente_vinculo_agente" },
    { label: "Com agente", value: "com_agente" },
    { label: "Com cliente", value: "com_cliente" },
    { label: "Encerrado resolvido", value: "encerrado_resolvido" },
    { label: "Encerrado não resolvido", value: "encerrado_nao_resolvido" },
];

const opcoesPrioridade: OpcaoSeletor[] = [
    { label: "Baixa", value: "baixa" },
    { label: "Média", value: "media" },
    { label: "Alta", value: "alta" },
    { label: "Muito alta", value: "muito_alta" },
];

function criarEstadoInicial(): FormularioDetalheTicket {
    return {
        titulo: "",
        empresa: null,
        produto: null,
        responsavel: null,
        agente: null,
        status: null,
        prioridade: null,
        criadoEm: "",
        criadoPor: "",
        atualizadoEm: "",
        fechadoEm: "",
        fechadoPor: "",
    };
}

function criarOpcaoUsuario(usuario: UsuarioFormularioApi): OpcaoSeletor {
    return {
        label: `${usuario.nome}${usuario.email ? ` - ${usuario.email}` : ""}`,
        value: String(usuario.id),
    };
}

function criarOpcaoTexto(label: string, value: number | string | null): OpcaoSeletor | null {
    return value ? { label: label, value: String(value) } : null;
}

function formatarDataHora(valor: string | null): string {
    if (!valor) {
        return "";
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return "";
    }

    const dataLocal = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return dataLocal.toISOString().slice(0, 16);
}

function sanitizarHtmlMensagem(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+="[^"]*"/gi, "")
        .replace(/\son\w+='[^']*'/gi, "")
        .replace(/javascript:/gi, "");
}

function limitarNomeAnexo(nomeOriginal: string): string {
    return nomeOriginal.length > 15
        ? `${nomeOriginal.slice(0, 15)}...`
        : nomeOriginal;
}

/**
 * Editor rico baseado em Quill para novas mensagens do ticket.
 */
function EditorMensagemTicket({
    id,
    value,
    disabled,
    onChange,
}: EditorMensagemTicketProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<import("quill").default | null>(null);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        let componenteMontado = true;

        async function inicializarEditor() {
            if (!containerRef.current || editorRef.current) {
                return;
            }

            const Quill = (await import("quill")).default;

            if (!componenteMontado || !containerRef.current) {
                return;
            }

            const editor = new Quill(containerRef.current, {
                theme: "snow",
                placeholder: "Digite uma mensagem",
                modules: {
                    toolbar: [
                        ["bold", "italic", "underline"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["link"],
                        ["clean"],
                    ],
                },
            });

            editor.root.innerHTML = value;
            editor.enable(!disabled);
            editor.on("text-change", () => {
                onChangeRef.current(editor.root.innerHTML, editor.getText().trim());
            });
            editorRef.current = editor;
        }

        void inicializarEditor();

        return () => {
            componenteMontado = false;
        };
    }, [disabled, value]);

    useEffect(() => {
        if (!editorRef.current) {
            return;
        }

        editorRef.current.enable(!disabled);
    }, [disabled]);

    useEffect(() => {
        if (!editorRef.current || editorRef.current.root.innerHTML === value) {
            return;
        }

        editorRef.current.root.innerHTML = value;
    }, [value]);

    return (
        <div
            id={id}
            ref={containerRef}
            className="min-h-32 bg-white text-sm text-slate-900"
        />
    );
}

/**
 * Modal de detalhe e edição de ticket existente.
 */
export default function ModalDetalheTicket({
    aberto,
    idTicket,
    aoFechar,
}: ModalDetalheTicketProps) {
    const [formulario, setFormulario] = useState<FormularioDetalheTicket>(criarEstadoInicial);
    const [mensagens, setMensagens] = useState<MensagemTicketApi[]>([]);
    const [opcoesResponsavel, setOpcoesResponsavel] = useState<OpcaoSeletor[]>([]);
    const [opcoesAgente, setOpcoesAgente] = useState<OpcaoSeletor[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [abaAtiva, setAbaAtiva] = useState<AbaTicket>("informacoesGerais");
    const [novaMensagem, setNovaMensagem] = useState("");
    const [textoNovaMensagem, setTextoNovaMensagem] = useState("");
    const [anexosNovaMensagem, setAnexosNovaMensagem] = useState<File[]>([]);
    const [idUsuarioLogado, setIdUsuarioLogado] = useState<number | null>(null);
    const [idResponsavelTicket, setIdResponsavelTicket] = useState<number | null>(null);
    const [idAgenteTicket, setIdAgenteTicket] = useState<number | null>(null);
    const [statusTicketAtual, setStatusTicketAtual] = useState("");
    const [confirmacaoAtualizacaoStatus, setConfirmacaoAtualizacaoStatus] = useState<ConfirmacaoAtualizacaoStatus | null>(null);
    const [baixandoAnexo, setBaixandoAnexo] = useState(false);
    const [podeEditarInformacoesGerais, setPodeEditarInformacoesGerais] = useState(false);
    const [podeEditarResponsavel, setPodeEditarResponsavel] = useState(false);
    const [podeEditarStatus, setPodeEditarStatus] = useState(false);
    const [podeEditarAgente, setPodeEditarAgente] = useState(false);
    const [podeEditarPrioridade, setPodeEditarPrioridade] = useState(false);

    function atualizarCampoFormulario(campo: keyof FormularioDetalheTicket, valor: string | OpcaoSeletor | null) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    function limparEstado() {
        setFormulario(criarEstadoInicial());
        setMensagens([]);
        setOpcoesResponsavel([]);
        setOpcoesAgente([]);
        setMensagemResposta("");
        setCarregando(false);
        setAbaAtiva("informacoesGerais");
        setNovaMensagem("");
        setTextoNovaMensagem("");
        setAnexosNovaMensagem([]);
        setIdUsuarioLogado(null);
        setIdResponsavelTicket(null);
        setIdAgenteTicket(null);
        setStatusTicketAtual("");
        setConfirmacaoAtualizacaoStatus(null);
        setBaixandoAnexo(false);
        setPodeEditarInformacoesGerais(false);
        setPodeEditarResponsavel(false);
        setPodeEditarStatus(false);
        setPodeEditarAgente(false);
        setPodeEditarPrioridade(false);
    }

    function obterClassesAba(aba: AbaTicket): string {
        const classesBase = "rounded-lg px-3 py-2 text-sm font-semibold transition";

        return abaAtiva === aba
            ? `${classesBase} bg-blue-600 text-white shadow-sm`
            : `${classesBase} bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
    }

    const carregarTicket = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const empresaNavegacaoId = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);

            if (!empresaNavegacaoId) {
                setMensagemResposta("Selecione uma empresa de navegação.");
                return;
            }

            const resposta = await requisitarAPI(`/api/tickets?id=${idTicket}&empresaNavegacaoId=${empresaNavegacaoId}`, {
                method: "GET",
            });
            const dados = resposta.dados as DadosDetalheTicketApi | null;

            if (!dados?.ticket) {
                setMensagemResposta("Não foi possível carregar o ticket selecionado.");
                return;
            }

            const ticket = dados.ticket;

            const respostaFormulario = await requisitarAPI(`/api/tickets/formulario/empresa?empresaId=${ticket.empresa_id}`, {
                method: "GET",
            });
            const dadosFormulario = respostaFormulario.dados as DadosFormularioEmpresaTicketApi | null;

            setOpcoesResponsavel((dadosFormulario?.usuariosAtivos ?? []).map(criarOpcaoUsuario));
            setOpcoesAgente((dadosFormulario?.agentesSuporte ?? []).map(criarOpcaoUsuario));
            setMensagens(dados.mensagens ?? []);
            setPodeEditarInformacoesGerais(Boolean(ticket.usuario_pode_editar_informacoes_gerais));
            setPodeEditarResponsavel(Boolean(ticket.usuario_pode_editar_responsavel));
            setPodeEditarStatus(Boolean(ticket.usuario_pode_editar_status));
            setPodeEditarAgente(Boolean(ticket.usuario_pode_editar_agente));
            setPodeEditarPrioridade(Boolean(ticket.usuario_pode_editar_prioridade));
            setIdUsuarioLogado(ticket.usuario_logado_id ?? null);
            setIdResponsavelTicket(ticket.responsavel_id);
            setIdAgenteTicket(ticket.agente_id);
            setStatusTicketAtual(ticket.status);
            setFormulario({
                titulo: ticket.titulo,
                empresa: criarOpcaoTexto(ticket.empresa_nome, ticket.empresa_id),
                produto: criarOpcaoTexto(ticket.produto_nome, ticket.produto_id),
                responsavel: criarOpcaoTexto(ticket.responsavel_nome, ticket.responsavel_id),
                agente: criarOpcaoTexto(ticket.agente_nome || "", ticket.agente_id),
                status: opcoesStatus.find((opcao) => opcao.value === ticket.status) || null,
                prioridade: opcoesPrioridade.find((opcao) => opcao.value === ticket.prioridade) || null,
                criadoEm: formatarDataHora(ticket.criado_em),
                criadoPor: ticket.criado_por_nome,
                atualizadoEm: formatarDataHora(ticket.ultima_atualizacao_em),
                fechadoEm: formatarDataHora(ticket.fechado_em),
                fechadoPor: ticket.fechado_por_nome || "",
            });
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar o ticket.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [idTicket]);

    async function salvarTicket(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!formulario.empresa || !formulario.responsavel || !formulario.status || !formulario.prioridade) {
            setMensagemResposta("Informe responsável, status e prioridade para atualizar o ticket.");
            return;
        }

        setCarregando(true);
        setMensagemResposta("");

        try {
            const empresaNavegacaoId = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);
            const resposta = await requisitarAPI("/api/tickets", {
                method: "PUT",
                body: {
                    id: idTicket,
                    empresaNavegacaoId: empresaNavegacaoId,
                    titulo: formulario.titulo,
                    responsavelId: formulario.responsavel.value,
                    agenteId: formulario.agente?.value ?? null,
                    status: formulario.status.value,
                    prioridade: formulario.prioridade.value,
                },
            });

            await carregarTicket();
            setMensagemResposta(resposta.msg || "Ticket atualizado com sucesso.");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível atualizar o ticket.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function iniciarEnvioMensagem() {
        if (!textoNovaMensagem) {
            setMensagemResposta("Informe uma mensagem para enviar no chat.");
            return;
        }

        const usuarioResponsavelTicket = Boolean(idUsuarioLogado && idUsuarioLogado === idResponsavelTicket);
        const usuarioAgenteTicket = Boolean(idUsuarioLogado && idUsuarioLogado === idAgenteTicket);

        if ((usuarioResponsavelTicket || usuarioAgenteTicket) && STATUS_TICKET_ENCERRADO.has(statusTicketAtual)) {
            void enviarMensagem(true);
            return;
        }

        if (usuarioResponsavelTicket) {
            setConfirmacaoAtualizacaoStatus({
                mensagem: "Deseja atualizar o ticket para o status de \"Com Agente\"?",
            });
            return;
        }

        if (usuarioAgenteTicket) {
            setConfirmacaoAtualizacaoStatus({
                mensagem: "Deseja atualizar o ticket para o status de \"Com Cliente\"?",
            });
            return;
        }

        void enviarMensagem(false);
    }

    async function enviarMensagem(atualizarStatusTicket: boolean) {
        if (!textoNovaMensagem) {
            setMensagemResposta("Informe uma mensagem para enviar no chat.");
            return;
        }

        setCarregando(true);
        setMensagemResposta("");

        try {
            const empresaNavegacaoId = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);
            const formData = new FormData();
            formData.append("ticketId", String(idTicket));
            formData.append("empresaNavegacaoId", empresaNavegacaoId ?? "");
            formData.append("conteudo", novaMensagem);
            formData.append("atualizarStatusTicket", String(atualizarStatusTicket));
            anexosNovaMensagem.forEach((anexo) => formData.append("anexos", anexo));

            const resposta = await requisitarAPI("/api/tickets/mensagens", {
                method: "POST",
                body: formData,
            });

            setNovaMensagem("");
            setTextoNovaMensagem("");
            setAnexosNovaMensagem([]);
            await carregarTicket();
            setAbaAtiva("chat");
            setMensagemResposta(resposta.msg || "Mensagem enviada com sucesso.");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível enviar a mensagem.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function selecionarAnexosNovaMensagem(event: ChangeEvent<HTMLInputElement>) {
        const arquivos = Array.from(event.target.files ?? []);

        if (arquivos.length === 0) {
            return;
        }

        const arquivoInvalido = arquivos.find((arquivo) => arquivo.size > TAMANHO_MAXIMO_ANEXO);

        if (arquivoInvalido) {
            setMensagemResposta(`O arquivo ${arquivoInvalido.name} excede o limite de 10 MB.`);
            event.target.value = "";
            return;
        }

        const tipoInvalido = arquivos.find((arquivo) => !TIPOS_ANEXO_PERMITIDOS.has(arquivo.type));

        if (tipoInvalido) {
            setMensagemResposta(`O tipo do arquivo ${tipoInvalido.name} não é permitido.`);
            event.target.value = "";
            return;
        }

        setAnexosNovaMensagem((estadoAtual) => [...estadoAtual, ...arquivos]);
        event.target.value = "";
    }

    function removerAnexoNovaMensagem(indiceAnexo: number) {
        setAnexosNovaMensagem((estadoAtual) => estadoAtual.filter((_, indice) => indice !== indiceAnexo));
    }

    async function baixarAnexo(anexo: AnexoMensagemTicketApi) {
        setBaixandoAnexo(true);
        setMensagemResposta("");

        try {
            const resposta = await fetch(`/api/tickets/anexos?id=${anexo.id}`);

            if (!resposta.ok) {
                const dados = await resposta.json().catch(() => null) as { msg?: string } | null;
                throw new Error(dados?.msg || "Não foi possível baixar o anexo.");
            }

            const arquivo = await resposta.blob();
            const urlArquivo = URL.createObjectURL(arquivo);
            const linkDownload = document.createElement("a");
            linkDownload.href = urlArquivo;
            linkDownload.download = anexo.nome_original;
            document.body.appendChild(linkDownload);
            linkDownload.click();
            linkDownload.remove();
            URL.revokeObjectURL(urlArquivo);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível baixar o anexo.";

            setMensagemResposta(mensagemErro);
        } finally {
            setBaixandoAnexo(false);
        }
    }

    useEffect(() => {
        if (!aberto) {
            return;
        }

        const carregamentoInicial = window.setTimeout(() => {
            void carregarTicket();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [aberto, carregarTicket]);

    return (
        <>
            <Modal
                show={aberto}
                onHide={aoFechar}
                onExited={limparEstado}
                centered
                size="xl"
            >
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        Ticket #{idTicket}
                    </Modal.Title>
                </Modal.Header>

                <form id="formulario-detalhe-ticket" onSubmit={salvarTicket}>
                    <Modal.Body>
                        <div className="mb-4 overflow-x-auto border-b border-slate-200 pb-3">
                            <div className="flex min-w-max gap-2">
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
                        </div>

                        {abaAtiva === "informacoesGerais" && (
                            <div className="grid gap-4 md:grid-cols-12">
                                <div className="md:col-span-12">
                                    <CampoTexto
                                        id="detalhe-ticket-titulo"
                                        label="Título"
                                        type="text"
                                        value={formulario.titulo}
                                        placeholder="Informe o título do ticket"
                                        onChange={(event) => atualizarCampoFormulario("titulo", event.target.value)}
                                        disabled={carregando || !podeEditarInformacoesGerais}
                                        required
                                        className="mb-0"
                                        maxLength={50}
                                    />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor id="detalhe-ticket-empresa" label="Empresa" options={formulario.empresa ? [formulario.empresa] : []} value={formulario.empresa} onChange={() => undefined} placeholder="" isDisabled isClearable={false} className="w-full" />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor id="detalhe-ticket-produto" label="Produto" options={formulario.produto ? [formulario.produto] : []} value={formulario.produto} onChange={() => undefined} placeholder="" isDisabled isClearable={false} className="w-full" />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor id="detalhe-ticket-responsavel" label="Responsável" options={opcoesResponsavel} value={formulario.responsavel} onChange={(opcao) => atualizarCampoFormulario("responsavel", opcao)} placeholder="Selecione o responsável" isDisabled={carregando || !podeEditarResponsavel} isClearable={false} className="w-full" />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor id="detalhe-ticket-agente" label="Agente" options={opcoesAgente} value={formulario.agente} onChange={(opcao) => atualizarCampoFormulario("agente", opcao)} placeholder="Selecione o agente" isDisabled={carregando || !podeEditarInformacoesGerais || !podeEditarAgente} isClearable className="w-full" />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor id="detalhe-ticket-status" label="Status" options={opcoesStatus} value={formulario.status} onChange={(opcao) => atualizarCampoFormulario("status", opcao)} placeholder="Selecione o status" isDisabled={carregando || !podeEditarStatus || STATUS_TICKET_ENCERRADO.has(statusTicketAtual)} isClearable={false} className="w-full" />
                                </div>

                                <div className="md:col-span-6">
                                    <Seletor id="detalhe-ticket-prioridade" label="Prioridade" options={opcoesPrioridade} value={formulario.prioridade} onChange={(opcao) => atualizarCampoFormulario("prioridade", opcao)} placeholder="Selecione a prioridade" isDisabled={carregando || !podeEditarInformacoesGerais || !podeEditarPrioridade} isClearable={false} className="w-full" />
                                </div>

                                <div className="md:col-span-3">
                                    <CampoTexto id="detalhe-ticket-criado-em" label="Criado em" type="datetime-local" value={formulario.criadoEm} placeholder="" onChange={() => undefined} disabled required={false} className="mb-0" />
                                </div>
                                <div className="md:col-span-3">
                                    <CampoTexto id="detalhe-ticket-criado-por" label="Criado por" type="text" value={formulario.criadoPor} placeholder="" onChange={() => undefined} disabled required={false} className="mb-0" />
                                </div>
                                <div className="md:col-span-3">
                                    <CampoTexto id="detalhe-ticket-atualizado-em" label="Última atualização em" type="datetime-local" value={formulario.atualizadoEm} placeholder="" onChange={() => undefined} disabled required={false} className="mb-0" />
                                </div>
                                <div className="md:col-span-3">
                                    <CampoTexto id="detalhe-ticket-fechado-em" label="Fechado em" type="datetime-local" value={formulario.fechadoEm} placeholder="" onChange={() => undefined} disabled required={false} className="mb-0" />
                                </div>
                                <div className="md:col-span-3">
                                    <CampoTexto id="detalhe-ticket-fechado-por" label="Fechado por" type="text" value={formulario.fechadoPor} placeholder="" onChange={() => undefined} disabled required={false} className="mb-0" />
                                </div>
                            </div>
                        )}

                        {abaAtiva === "chat" && (
                            <div className="flex max-h-[70vh] min-h-[28rem] flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50 md:h-[70vh] md:min-h-[42rem] md:max-h-[64rem]">
                                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                    {mensagens.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                                            Nenhuma mensagem registrada para este ticket.
                                        </div>
                                    )}

                                    {mensagens.map((mensagem) => (
                                        <div key={mensagem.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                                <strong className="text-slate-700">{mensagem.enviado_por_nome}</strong>
                                                <span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(mensagem.enviado_em))}</span>
                                            </div>
                                            <div className="prose prose-sm max-w-none text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: sanitizarHtmlMensagem(mensagem.conteudo) }} />
                                            {(mensagem.anexos ?? []).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {mensagem.anexos?.map((anexo) => (
                                                        <a
                                                            key={anexo.id}
                                                            href={`/api/tickets/anexos?id=${anexo.id}`}
                                                            onClick={(event) => {
                                                                event.preventDefault();
                                                                void baixarAnexo(anexo);
                                                            }}
                                                            className="text-[10px] font-semibold text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                                                            title={anexo.nome_original}
                                                        >
                                                            {limitarNomeAnexo(anexo.nome_original)}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="shrink-0 border-t border-slate-200 bg-white p-3">
                                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(13rem,17rem)]">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700" htmlFor="detalhe-ticket-chat-mensagem">
                                                Nova mensagem
                                            </label>
                                            <div className="mt-1 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 [&_.ql-editor]:max-h-24 [&_.ql-editor]:min-h-20 [&_.ql-editor]:overflow-y-auto [&_.ql-toolbar]:px-2 [&_.ql-toolbar]:py-1">
                                                <EditorMensagemTicket
                                                    id="detalhe-ticket-chat-mensagem"
                                                    value={novaMensagem}
                                                    disabled={carregando}
                                                    onChange={(html, texto) => {
                                                        setNovaMensagem(html);
                                                        setTextoNovaMensagem(texto);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700" htmlFor="detalhe-ticket-chat-anexos">
                                                Anexos
                                            </label>
                                            <input
                                                id="detalhe-ticket-chat-anexos"
                                                type="file"
                                                multiple
                                                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                                                onChange={selecionarAnexosNovaMensagem}
                                                disabled={carregando}
                                                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                            />
                                            {anexosNovaMensagem.length > 0 && (
                                                <div className="mt-2 space-y-2">
                                                    {anexosNovaMensagem.map((anexo, indice) => (
                                                        <div key={`${anexo.name}-${anexo.lastModified}-${indice}`} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                                            <span className="min-w-0 truncate">{anexo.name}</span>
                                                            <button
                                                                type="button"
                                                                className="font-semibold text-red-600 hover:text-red-700"
                                                                onClick={() => removerAnexoNovaMensagem(indice)}
                                                                disabled={carregando}
                                                            >
                                                                Remover
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                        <Botao
                                            size="sm"
                                            label="Enviar mensagem"
                                            icon={<FaPaperPlane />}
                                            onClick={() => {
                                                iniciarEnvioMensagem();
                                            }}
                                            disabled={carregando || !textoNovaMensagem}
                                            loading={carregando}
                                            variant="outline-primary"
                                            type="button"
                                            className="w-full sm:w-auto"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </Modal.Body>

                    <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Botao size="sm" label="Cancelar" icon={<FaTimes />} onClick={aoFechar} disabled={carregando} loading={false} variant="outline-secondary" type="button" className="w-full sm:w-auto" />
                        <Botao size="sm" label="Salvar ticket" icon={<FaSave />} onClick={() => undefined} disabled={carregando || (!podeEditarInformacoesGerais && !podeEditarStatus)} loading={carregando} variant="outline-primary" type="submit" className="w-full sm:w-auto" />
                    </Modal.Footer>
                </form>
            </Modal>

            <ModalCarregamento show={aberto && (carregando || baixandoAnexo)} text={baixandoAnexo ? "Baixando anexo..." : "Carregando dados do ticket..."} />

            <Modal
                show={aberto && Boolean(confirmacaoAtualizacaoStatus)}
                onHide={() => setConfirmacaoAtualizacaoStatus(null)}
                centered
                size="sm"
            >
                <Modal.Body className="px-6 pt-6 text-center">
                    <p className="mb-0 font-bold text-slate-800">
                        {confirmacaoAtualizacaoStatus?.mensagem}
                    </p>
                </Modal.Body>
                <Modal.Footer className="grid grid-cols-1 gap-2 border-0 px-6 pb-6 pt-4 sm:grid-cols-2">
                    <Botao
                        size="sm"
                        label="Não"
                        onClick={() => {
                            setConfirmacaoAtualizacaoStatus(null);
                            void enviarMensagem(false);
                        }}
                        disabled={carregando}
                        loading={false}
                        variant="outline-secondary"
                        type="button"
                        className="w-full"
                    />
                    <Botao
                        size="sm"
                        label="Sim"
                        onClick={() => {
                            setConfirmacaoAtualizacaoStatus(null);
                            void enviarMensagem(true);
                        }}
                        disabled={carregando}
                        loading={carregando}
                        variant="primary"
                        type="button"
                        className="w-full"
                    />
                </Modal.Footer>
            </Modal>

            <ModalResposta
                isOpen={aberto && Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />
        </>
    );
}
