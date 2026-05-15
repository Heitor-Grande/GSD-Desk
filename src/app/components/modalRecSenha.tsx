"use client";

import { FormEvent, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaEnvelope, FaKey, FaLock } from "react-icons/fa";
import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";

interface ModalRecSenhaProps {
    isOpen: boolean;
    onClose: () => void;
}

type EtapaRecuperacaoSenha = "email" | "codigo" | "senha" | "concluido";

type DadosRecuperacaoSenha = {
    token: string;
};

/**
 * Verifica se o retorno da API possui o token temporário de recuperação.
 * Use antes de salvar o token no armazenamento de sessão do navegador.
 */
function validarDadosRecuperacaoSenha(dados: unknown): dados is DadosRecuperacaoSenha {
    return (
        typeof dados === "object"
        && dados !== null
        && "token" in dados
        && typeof dados.token === "string"
    );
}

/**
 * Modal de recuperação de senha por e-mail.
 * Use na tela de login para capturar e-mail, validar código e cadastrar uma nova senha.
 */
export default function ModalRecSenha({
    isOpen,
    onClose,
}: ModalRecSenhaProps) {
    const [etapa, setEtapa] = useState<EtapaRecuperacaoSenha>("email");
    const [email, setEmail] = useState("");
    const [codigo, setCodigo] = useState("");
    const [senha, setSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [mensagem, setMensagem] = useState("");
    const [carregando, setCarregando] = useState(false);

    /**
     * Envia o e-mail para a API de recuperação e armazena o token temporário na sessão.
     */
    async function enviarRecuperacaoSenha(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const emailNormalizado = email.trim();

        if (!emailNormalizado) {
            setMensagem("Informe o e-mail cadastrado para recuperar sua senha.");
            return;
        }

        setCarregando(true);
        setMensagem("");

        try {
            const resposta = await requisitarAPI("/api/auth/recSenha", {
                method: "POST",
                body: {
                    email: emailNormalizado,
                },
            });

            if (!validarDadosRecuperacaoSenha(resposta.dados)) {
                throw new Error("Não foi possível obter o token de recuperação.");
            }

            sessionStorage.setItem("rec_senha_token", resposta.dados.token);
            setEtapa("codigo");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível enviar o e-mail de recuperação.";

            setMensagem(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Valida o código informado com o token temporário salvo na sessão.
     */
    async function validarCodigoRecuperacao(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const codigoNormalizado = codigo.trim();
        const token = sessionStorage.getItem("rec_senha_token") ?? "";

        if (!/^\d{5}$/.test(codigoNormalizado)) {
            setMensagem("Informe o código de cinco dígitos recebido por e-mail.");
            return;
        }

        setCarregando(true);
        setMensagem("");

        try {
            await requisitarAPI("/api/auth/recSenha", {
                method: "PUT",
                body: {
                    codigo: codigoNormalizado,
                    token: token,
                },
            });

            setEtapa("senha");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível validar o código de recuperação.";

            setMensagem(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Envia a nova senha para alteração depois da validação do código.
     */
    async function alterarSenhaRecuperacao(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const token = sessionStorage.getItem("rec_senha_token") ?? "";

        if (senha.length < 6) {
            setMensagem("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        if (senha !== confirmarSenha) {
            setMensagem("As senhas informadas não conferem.");
            return;
        }

        setCarregando(true);
        setMensagem("");

        try {
            await requisitarAPI("/api/auth/recSenha", {
                method: "PATCH",
                body: {
                    codigo: codigo.trim(),
                    token: token,
                    senha: senha,
                    confirmarSenha: confirmarSenha,
                },
            });

            sessionStorage.removeItem("rec_senha_token");
            setEtapa("concluido");
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível alterar a senha.";

            setMensagem(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    /**
     * Fecha o modal e limpa o estado local para uma nova tentativa.
     */
    function fecharModal() {
        setEtapa("email");
        setEmail("");
        setCodigo("");
        setSenha("");
        setConfirmarSenha("");
        setMensagem("");
        setCarregando(false);
        onClose();
    }

    return (
        <>
            <Modal show={isOpen} onHide={fecharModal} centered contentClassName="response-modal border-0 rounded-xl shadow-2xl">
                <Modal.Header closeButton className="border-b border-slate-100 px-5 py-4">
                    <Modal.Title className="text-lg font-bold">
                        Recuperar senha
                    </Modal.Title>
                </Modal.Header>

                {etapa === "email" && (
                    <form onSubmit={enviarRecuperacaoSenha}>
                        <Modal.Body>
                            <div className="mb-4 flex items-start gap-3">
                                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                                    <FaKey />
                                </span>

                                <div>
                                    <p className="mb-1 font-semibold text-slate-800">
                                        Informe seu e-mail de acesso
                                    </p>
                                    <p className="mb-0 text-slate-500">
                                        Você receberá um código de cinco dígitos para continuar a recuperação da senha.
                                    </p>
                                </div>
                            </div>

                            <CampoTexto
                                id="email-recuperacao-senha"
                                label="E-mail"
                                type="email"
                                value={email}
                                placeholder="email@empresa.com"
                                onChange={(event) => {
                                    setEmail(event.target.value);
                                    setMensagem("");
                                }}
                                disabled={carregando}
                                required
                                className="mb-0"
                            />
                        </Modal.Body>

                        <Modal.Footer className="border-0 px-5 pb-5 pt-0">
                            <div className="flex w-full gap-2">
                                <Botao
                                    size="sm"
                                    label="Cancelar"
                                    onClick={fecharModal}
                                    disabled={carregando}
                                    loading={false}
                                    variant="outline-secondary"
                                    type="button"
                                    className="w-full"
                                />

                                <Botao
                                    size="sm"
                                    label="Enviar código"
                                    onClick={() => undefined}
                                    disabled={carregando}
                                    loading={false}
                                    variant="primary"
                                    type="submit"
                                    className="w-full"
                                />
                            </div>
                        </Modal.Footer>
                    </form>
                )}

                {etapa === "codigo" && (
                    <form onSubmit={validarCodigoRecuperacao}>
                        <Modal.Body>
                            <div className="mb-4 flex items-start gap-3">
                                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600">
                                    <FaEnvelope />
                                </span>

                                <div>
                                    <p className="mb-1 font-semibold text-slate-800">
                                        Digite o código recebido
                                    </p>
                                    <p className="mb-0 text-slate-500">
                                        Enviamos o código para o e-mail informado. Ele possui cinco dígitos.
                                    </p>
                                </div>
                            </div>

                            <CampoTexto
                                id="codigo-recuperacao-senha"
                                label="Código"
                                type="text"
                                value={codigo}
                                placeholder="00000"
                                onChange={(event) => {
                                    setCodigo(event.target.value.replace(/\D/g, "").slice(0, 5));
                                    setMensagem("");
                                }}
                                disabled={carregando}
                                required
                                className="mb-0"
                            />
                        </Modal.Body>

                        <Modal.Footer className="border-0 px-5 pb-5 pt-0">
                            <div className="flex w-full gap-2">
                                <Botao
                                    size="sm"
                                    label="Cancelar"
                                    onClick={fecharModal}
                                    disabled={carregando}
                                    loading={false}
                                    variant="outline-secondary"
                                    type="button"
                                    className="w-full"
                                />

                                <Botao
                                    size="sm"
                                    label="Validar código"
                                    onClick={() => undefined}
                                    disabled={carregando}
                                    loading={false}
                                    variant="primary"
                                    type="submit"
                                    className="w-full"
                                />
                            </div>
                        </Modal.Footer>
                    </form>
                )}

                {etapa === "senha" && (
                    <form onSubmit={alterarSenhaRecuperacao}>
                        <Modal.Body>
                            <div className="mb-4 flex items-start gap-3">
                                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                                    <FaLock />
                                </span>

                                <div>
                                    <p className="mb-1 font-semibold text-slate-800">
                                        Cadastre uma nova senha
                                    </p>
                                    <p className="mb-0 text-slate-500">
                                        Use pelo menos seis caracteres e confirme a senha antes de finalizar.
                                    </p>
                                </div>
                            </div>

                            <CampoTexto
                                id="nova-senha-recuperacao"
                                label="Nova senha"
                                type="password"
                                value={senha}
                                placeholder="Digite a nova senha"
                                onChange={(event) => {
                                    setSenha(event.target.value);
                                    setMensagem("");
                                }}
                                disabled={carregando}
                                required
                                className="mb-3"
                            />

                            <CampoTexto
                                id="confirmar-nova-senha-recuperacao"
                                label="Confirmar nova senha"
                                type="password"
                                value={confirmarSenha}
                                placeholder="Confirme a nova senha"
                                onChange={(event) => {
                                    setConfirmarSenha(event.target.value);
                                    setMensagem("");
                                }}
                                disabled={carregando}
                                required
                                className="mb-0"
                            />
                        </Modal.Body>

                        <Modal.Footer className="border-0 px-5 pb-5 pt-0">
                            <div className="flex w-full gap-2">
                                <Botao
                                    size="sm"
                                    label="Cancelar"
                                    onClick={fecharModal}
                                    disabled={carregando}
                                    loading={false}
                                    variant="outline-secondary"
                                    type="button"
                                    className="w-full"
                                />

                                <Botao
                                    size="sm"
                                    label="Alterar senha"
                                    onClick={() => undefined}
                                    disabled={carregando}
                                    loading={false}
                                    variant="primary"
                                    type="submit"
                                    className="w-full"
                                />
                            </div>
                        </Modal.Footer>
                    </form>
                )}

                {etapa === "concluido" && (
                    <>
                        <Modal.Body className="px-6 pb-5 pt-7 text-center">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600">
                                <FaLock />
                            </span>

                            <h3 className="mb-2 mt-3 text-lg font-bold text-slate-900">
                                Senha alterada
                            </h3>

                            <p className="mb-0 text-slate-500">
                                Sua senha foi atualizada com sucesso. Você já pode acessar a conta com a nova senha.
                            </p>
                        </Modal.Body>

                        <Modal.Footer className="border-0 px-5 pb-5 pt-0">
                            <Botao
                                size="sm"
                                label="Entendi"
                                onClick={fecharModal}
                                disabled={false}
                                loading={false}
                                variant="primary"
                                type="button"
                                className="w-full"
                            />
                        </Modal.Footer>
                    </>
                )}
            </Modal>

            <ModalResposta
                isOpen={Boolean(mensagem)}
                message={mensagem}
                onClose={() => setMensagem("")}
            />

            <ModalCarregamento
                show={carregando}
                text="Processando recuperação de senha..."
            />
        </>
    );
}
