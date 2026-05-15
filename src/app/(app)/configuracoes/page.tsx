"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { Seletor } from "@/components/inputs/select";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { FaSave } from "react-icons/fa";

type OpcaoDisponibilidade = {
    label: string;
    value: string;
};

type DadosConfiguracaoAplicacao = {
    fantasiaEmpresa: string;
    cnpjEmpresa: string;
    emailSuporteContato: string;
    contato: string;
    disponibilidade: OpcaoDisponibilidade | null;
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPass: string;
    smtpFrom: string;
};

type ConfiguracaoAplicacaoApi = {
    fantasia: string;
    cnpj: string;
    email_suporte_contato: string;
    contato: string;
    disponibilidade: string;
    smtp_host: string;
    smtp_port: string;
    smtp_user: string;
    smtp_pass: string;
    smtp_from: string;
};

const opcoesDisponibilidade: OpcaoDisponibilidade[] = [
    { label: "Disponível", value: "disponivel" },
    { label: "Bloqueado para manutenção", value: "bloqueado_manutencao" },
    { label: "Bloqueado por falta de pagamento", value: "bloqueado_pagamento" },
];

const estadoInicialConfiguracao: DadosConfiguracaoAplicacao = {
    fantasiaEmpresa: "",
    cnpjEmpresa: "",
    emailSuporteContato: "",
    contato: "",
    disponibilidade: opcoesDisponibilidade[0],
    smtpHost: "",
    smtpPort: "",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
};

function obterOpcaoDisponibilidade(valor: string): OpcaoDisponibilidade {
    return opcoesDisponibilidade.find((opcao) => opcao.value === valor) ?? opcoesDisponibilidade[0];
}

function mapearConfiguracaoParaFormulario(configuracao: ConfiguracaoAplicacaoApi): DadosConfiguracaoAplicacao {
    return {
        fantasiaEmpresa: configuracao.fantasia,
        cnpjEmpresa: configuracao.cnpj,
        emailSuporteContato: configuracao.email_suporte_contato,
        contato: configuracao.contato,
        disponibilidade: obterOpcaoDisponibilidade(configuracao.disponibilidade),
        smtpHost: configuracao.smtp_host,
        smtpPort: configuracao.smtp_port,
        smtpUser: configuracao.smtp_user,
        smtpPass: configuracao.smtp_pass,
        smtpFrom: configuracao.smtp_from,
    };
}

/**
 * Página de configuração da aplicação.
 * Use como base para controlar dados da empresa, disponibilidade e envio de e-mails transacionais.
 */
export default function PaginaConfiguracoes() {
    const [formulario, setFormulario] = useState<DadosConfiguracaoAplicacao>(estadoInicialConfiguracao);
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [carregando, setCarregando] = useState(false);

    function atualizarCampoFormulario(campo: keyof DadosConfiguracaoAplicacao, valor: string | OpcaoDisponibilidade | null) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: valor,
        }));
    }

    /**
     * Carrega o registro único de configuração e preenche o formulário.
     */
    const carregarConfiguracoesAplicacao = useCallback(async () => {
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/configuracoes", {
                method: "GET",
            });

            const configuracao = resposta.dados as ConfiguracaoAplicacaoApi | null;

            if (configuracao) {
                setFormulario(mapearConfiguracaoParaFormulario(configuracao));
            }
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível carregar as configurações.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }, []);

    /**
     * Atualiza o registro único de configuração da aplicação.
     */
    async function salvarConfiguracoesAplicacao(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCarregando(true);
        setMensagemResposta("");

        try {
            const resposta = await requisitarAPI("/api/configuracoes", {
                method: "PUT",
                body: {
                    fantasia: formulario.fantasiaEmpresa,
                    cnpj: formulario.cnpjEmpresa,
                    emailSuporteContato: formulario.emailSuporteContato,
                    contato: formulario.contato,
                    disponibilidade: formulario.disponibilidade?.value,
                    smtpHost: formulario.smtpHost,
                    smtpPort: formulario.smtpPort,
                    smtpUser: formulario.smtpUser,
                    smtpPass: formulario.smtpPass,
                    smtpFrom: formulario.smtpFrom,
                },
            });

            const configuracao = resposta.dados as ConfiguracaoAplicacaoApi | null;

            if (configuracao) {
                setFormulario(mapearConfiguracaoParaFormulario(configuracao));
            }

            setMensagemResposta(resposta.msg);
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível atualizar as configurações.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        const carregamentoInicial = window.setTimeout(() => {
            void carregarConfiguracoesAplicacao();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [carregarConfiguracoesAplicacao]);

    return (
        <div className="w-full">
            <div className="mb-6">
                <div className="w-full rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <h5 className="text-lg font-bold text-slate-900">Configurações</h5>
                        <hr className="my-4 border-slate-200" />
                        <p className="mb-0 text-slate-500">
                            Controle os dados principais da empresa, a disponibilidade da aplicação e o envio de e-mails.
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={salvarConfiguracoesAplicacao}>
                <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
                    <div className="p-6">
                        <h5 className="mb-0 text-lg font-bold text-slate-900">Dados da aplicação</h5>
                        <hr className="my-4 border-slate-200" />
                        <div className="grid gap-4 md:grid-cols-12">
                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="configuracao-fantasia-empresa"
                                    label="Fantasia da empresa"
                                    type="text"
                                    value={formulario.fantasiaEmpresa}
                                    placeholder="Nome fantasia"
                                    onChange={(event) => atualizarCampoFormulario("fantasiaEmpresa", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="configuracao-cnpj-empresa"
                                    label="CNPJ da empresa"
                                    type="text"
                                    value={formulario.cnpjEmpresa}
                                    placeholder="00.000.000/0000-00"
                                    onChange={(event) => atualizarCampoFormulario("cnpjEmpresa", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="configuracao-email-suporte-contato"
                                    label="E-mail suporte/contato"
                                    type="email"
                                    value={formulario.emailSuporteContato}
                                    placeholder="suporte@empresa.com"
                                    onChange={(event) => atualizarCampoFormulario("emailSuporteContato", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="configuracao-contato"
                                    label="Contato"
                                    type="text"
                                    value={formulario.contato}
                                    placeholder="Nome ou telefone de contato"
                                    onChange={(event) => atualizarCampoFormulario("contato", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <Seletor
                                    id="configuracao-disponibilidade"
                                    label="Disponibilidade"
                                    options={opcoesDisponibilidade}
                                    value={formulario.disponibilidade}
                                    onChange={(opcao) => atualizarCampoFormulario("disponibilidade", opcao)}
                                    placeholder="Selecione a disponibilidade"
                                    isDisabled={carregando}
                                    isClearable={false}
                                    className="mb-0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-0">
                        <h5 className="mb-0 text-lg font-bold text-slate-900">Envio de e-mails</h5>
                        <hr className="my-4 border-slate-200" />

                        <div className="grid gap-4 md:grid-cols-12">
                            <div className="md:col-span-8">
                                <CampoTexto
                                    id="configuracao-smtp-host"
                                    label="Servidor SMTP"
                                    type="text"
                                    value={formulario.smtpHost}
                                    placeholder="smtp.exemplo.com"
                                    onChange={(event) => atualizarCampoFormulario("smtpHost", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-4">
                                <CampoTexto
                                    id="configuracao-smtp-port"
                                    label="Porta SMTP"
                                    type="number"
                                    value={formulario.smtpPort}
                                    placeholder="587"
                                    onChange={(event) => atualizarCampoFormulario("smtpPort", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="configuracao-smtp-user"
                                    label="Usuário SMTP"
                                    type="text"
                                    value={formulario.smtpUser}
                                    placeholder="usuario-smtp"
                                    onChange={(event) => atualizarCampoFormulario("smtpUser", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-6">
                                <CampoTexto
                                    id="configuracao-smtp-pass"
                                    label="Senha SMTP"
                                    type="password"
                                    value={formulario.smtpPass}
                                    placeholder="senha-smtp"
                                    onChange={(event) => atualizarCampoFormulario("smtpPass", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>

                            <div className="md:col-span-12">
                                <CampoTexto
                                    id="configuracao-smtp-from"
                                    label="Remetente"
                                    type="text"
                                    value={formulario.smtpFrom}
                                    placeholder="nao-responder@exemplo.com"
                                    onChange={(event) => atualizarCampoFormulario("smtpFrom", event.target.value)}
                                    disabled={carregando}
                                    required
                                    className="mb-0"
                                />
                            </div>
                        </div>
                        <hr className="my-4 border-slate-200" />
                        <div className="flex justify-end">
                            <Botao
                                size="sm"
                                label="Salvar configurações"
                                icon={<FaSave />}
                                onClick={() => undefined}
                                disabled={carregando}
                                loading={false}
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
                text="Processando configurações..."
            />
        </div>
    );
}
