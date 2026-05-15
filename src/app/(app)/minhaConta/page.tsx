"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { Seletor } from "@/components/inputs/select";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { FaSave } from "react-icons/fa";

type DadosMinhaConta = {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    documento: string;
    perfil: OpcaoPerfil | null;
    senha: string;
    confirmarSenha: string;
    ativo: boolean;
    isAdmin: boolean;
    criadoEm: string;
    atualizadoEm: string;
};

type OpcaoPerfil = {
    label: string;
    value: string;
};

type UsuarioMinhaContaApi = {
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

const estadoInicialFormulario: DadosMinhaConta = {
    id: "",
    nome: "",
    email: "",
    telefone: "",
    documento: "",
    perfil: null,
    senha: "",
    confirmarSenha: "",
    ativo: true,
    isAdmin: false,
    criadoEm: "",
    atualizadoEm: "",
};

/**
 * Página de Minha conta.
 * Use como ponto de partida para edição dos dados do usuário autenticado.
 */
export default function PaginaMinhaConta() {
    const [formulario, setFormulario] = useState<DadosMinhaConta>(estadoInicialFormulario);
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Processando solicitação...");
    const [mensagemResposta, setMensagemResposta] = useState("");

    function atualizarCampoFormulario(campo: keyof DadosMinhaConta, valor: string | boolean | OpcaoPerfil | null) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    const formatarDataHoraLocal = useCallback((valor: string): string => {
        if (!valor) {
            return "";
        }

        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
            return "";
        }

        const dataLocal = new Date(data.getTime() - data.getTimezoneOffset() * 60000);

        return dataLocal.toISOString().slice(0, 16);
    }, []);

    const mapearUsuarioParaFormulario = useCallback((usuario: UsuarioMinhaContaApi): DadosMinhaConta => {

        return {
            id: String(usuario.id),
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
            senha: "",
            confirmarSenha: "",
            ativo: usuario.ativo,
            isAdmin: usuario.isAdmin,
            criadoEm: formatarDataHoraLocal(usuario.criado_em),
            atualizadoEm: formatarDataHoraLocal(usuario.atualizado_em),
        };
    }, [formatarDataHoraLocal]);

    /**
     * Carrega os dados do usuário autenticado usando o JWT salvo no cookie de sessão.
     */
    const carregarDadosMinhaConta = useCallback(async () => {
        setCarregando(true);
        setTextoCarregamento("Carregando dados da conta...");
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/minhaConta", {
                method: "GET",
            });

            const usuario = resposta.dados as UsuarioMinhaContaApi | null;

            if (!usuario) {
                setMensagemResposta("Não foi possível carregar os dados da conta.");
                return;
            }

            setFormulario(mapearUsuarioParaFormulario(usuario));
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar os dados da conta.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, [mapearUsuarioParaFormulario]);

    /**
     * Valida o formulário e envia os dados editáveis para a API de usuários.
     */
    async function salvarDadosMinhaConta(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMensagemResposta("");

        if (formulario.senha && formulario.senha !== formulario.confirmarSenha) {
            setMensagemResposta("As senhas informadas não conferem.");
            return;
        }

        setCarregando(true);
        setTextoCarregamento("Salvando dados da conta...");

        try {
            const resposta = await requisitarAPI("/api/minhaConta", {
                method: "PUT",
                body: formulario,
            });

            const mensagem =
                typeof resposta.msg === "string"
                    ? resposta.msg
                    : "Dados da conta atualizados com sucesso.";

            await carregarDadosMinhaConta();
            setMensagemResposta(mensagem);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível salvar os dados da conta.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarDadosMinhaConta();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarDadosMinhaConta]);

    return (
        <div className="w-full">
            <div className="mb-6">
                <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <h5 className="mb-1 text-lg font-bold text-slate-900">Minha conta</h5>
                        <hr className="my-4 border-slate-200" />
                        <p className="mb-0 text-slate-500">
                            Atualize as informações básicas da conta vinculada ao usuário autenticado.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={salvarDadosMinhaConta}>
                <div className="rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <div className="grid gap-4 md:grid-cols-12">

                            <div className="md:col-span-4">
                                <CampoTexto
                                    id="minha-conta-nome"
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

                            <div className="md:col-span-4">
                                <CampoTexto
                                    id="minha-conta-email"
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

                            <div className="md:col-span-4">
                                <Seletor
                                    id="minha-conta-perfil"
                                    label="Perfil"
                                    options={formulario.perfil ? [formulario.perfil] : []}
                                    value={formulario.perfil}
                                    onChange={() => undefined}
                                    placeholder="Sem perfil vinculado"
                                    isDisabled
                                    isClearable={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="minha-conta-telefone"
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
                                    id="minha-conta-documento"
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
                                <CampoTexto
                                    id="minha-conta-senha"
                                    label="Nova senha"
                                    type="password"
                                    value={formulario.senha}
                                    placeholder="Digite uma nova senha"
                                    onChange={(event) => atualizarCampoFormulario("senha", event.target.value)}
                                    disabled={carregando}
                                    required={false}
                                    className="mb-0"
                                    helpText="Preencha apenas se quiser alterar a senha atual."
                                    classNameHelpText="mt-1 block text-sm text-slate-500"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="minha-conta-confirmar-senha"
                                    label="Confirmar nova senha"
                                    type="password"
                                    value={formulario.confirmarSenha}
                                    placeholder="Repita a nova senha"
                                    onChange={(event) => atualizarCampoFormulario("confirmarSenha", event.target.value)}
                                    disabled={carregando}
                                    required={Boolean(formulario.senha)}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="minha-conta-criado-em"
                                    label="Criado em"
                                    type="datetime-local"
                                    value={formulario.criadoEm}
                                    placeholder=""
                                    onChange={(event) => atualizarCampoFormulario("criadoEm", event.target.value)}
                                    disabled
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="minha-conta-atualizado-em"
                                    label="Atualizado em"
                                    type="datetime-local"
                                    value={formulario.atualizadoEm}
                                    placeholder=""
                                    onChange={(event) => atualizarCampoFormulario("atualizadoEm", event.target.value)}
                                    disabled
                                    required={false}
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <label className="flex items-center gap-3 text-sm font-semibold text-slate-700" htmlFor="minha-conta-ativo">
                                    <input
                                        id="minha-conta-ativo"
                                        type="checkbox"
                                        checked={formulario.ativo}
                                        disabled={carregando}
                                        onChange={(event) => atualizarCampoFormulario("ativo", event.target.checked)}
                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                    Usuário ativo
                                </label>
                            </div>

                            <div className="md:col-span-6">
                                <label className="flex items-center gap-3 text-sm font-semibold text-slate-700" htmlFor="minha-conta-admin">
                                    <input
                                        id="minha-conta-admin"
                                        type="checkbox"
                                        checked={formulario.isAdmin}
                                        disabled
                                        onChange={(event) => atualizarCampoFormulario("isAdmin", event.target.checked)}
                                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                    Administrador
                                </label>
                            </div>
                        </div>
                        <hr className="my-4 border-slate-200" />
                        <div className="flex justify-end">
                            <Botao
                                size="sm"
                                label="Salvar alterações"
                                icon={<FaSave />}
                                onClick={() => undefined}
                                disabled={false}
                                loading={carregando}
                                variant="outline-primary"
                                type="submit"
                                className=""
                            />
                        </div>
                    </div>
                </div>
            </form>

            <ModalResposta
                isOpen={Boolean(mensagemResposta)}
                message={mensagemResposta}
                onClose={() => setMensagemResposta("")}
            />

            <ModalCarregamento
                show={carregando}
                text={textoCarregamento}
            />
        </div>
    );
}
