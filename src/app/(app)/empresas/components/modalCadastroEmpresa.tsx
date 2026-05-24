"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import VinculoUsuarioEmpresa from "@/components/VinculoUsuarioEmpresa";
import ModalConfirmacao from "@/components/modals/confirmModal";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { FaExclamationTriangle, FaInfoCircle, FaSave, FaTimes, FaTrash } from "react-icons/fa";
import ProdutosEmpresa from "./produtosEmpresa";

type DadosCadastroEmpresa = {
    id: number | null;
    fantasia: string;
    cnpj: string;
    email: string;
    telefone: string;
    ativo: boolean;
    exigirVinculoProduto: boolean;
    criadoEm: string;
    atualizadoEm: string;
};

type EmpresaDetalhadaApi = {
    id: number;
    fantasia: string;
    cnpj: string;
    email: string | null;
    telefone: string | null;
    ativo: boolean;
    exigir_vinculo_produto: boolean;
    criado_em: string;
    atualizado_em: string;
};

type ModalCadastroEmpresaProps = {
    aberto: boolean;
    idEmpresa?: number | null;
    aoFechar: () => void;
};

type AbaEmpresa = "dados" | "usuarios" | "produtos" | "regras";

const estadoInicialFormulario: DadosCadastroEmpresa = {
    id: null,
    fantasia: "",
    cnpj: "",
    email: "",
    telefone: "",
    ativo: true,
    exigirVinculoProduto: false,
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

function mapearEmpresaParaFormulario(empresa: EmpresaDetalhadaApi): DadosCadastroEmpresa {
    return {
        id: empresa.id,
        fantasia: empresa.fantasia,
        cnpj: formatarCnpj(empresa.cnpj),
        email: empresa.email || "",
        telefone: empresa.telefone || "",
        ativo: empresa.ativo,
        exigirVinculoProduto: empresa.exigir_vinculo_produto,
        criadoEm: formatarDataHoraFormulario(empresa.criado_em),
        atualizadoEm: formatarDataHoraFormulario(empresa.atualizado_em),
    };
}

/**
 * Modal local de cadastro e visualização de empresa.
 * Use no fluxo de empresas para cadastrar, editar e excluir registros pela API de empresas.
 */
export default function ModalCadastroEmpresa({
    aberto,
    idEmpresa,
    aoFechar,
}: ModalCadastroEmpresaProps) {
    const [formulario, setFormulario] = useState<DadosCadastroEmpresa>(estadoInicialFormulario);
    const [carregando, setCarregando] = useState(false);
    const [textoCarregamento, setTextoCarregamento] = useState("Processando solicitação...");
    const [mensagemResposta, setMensagemResposta] = useState("");
    const [modalConfirmacaoExclusaoAberto, setModalConfirmacaoExclusaoAberto] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState<AbaEmpresa>("dados");

    const estaVisualizandoEmpresa = typeof idEmpresa === "number" && idEmpresa > 0;

    function atualizarCampoFormulario(campo: keyof DadosCadastroEmpresa, valor: string | boolean) {
        setFormulario((estadoAtual) => ({
            ...estadoAtual,
            [campo]: campo === "cnpj" && typeof valor === "string" ? formatarCnpj(valor) : valor,
        }));
    }

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
            const empresa = resposta.dados as EmpresaDetalhadaApi | null;

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

    function limparEstadoModalCadastroEmpresa() {
        setFormulario(estadoInicialFormulario);
        setMensagemResposta("");
        setCarregando(false);
        setModalConfirmacaoExclusaoAberto(false);
        setAbaAtiva("dados");
    }

    function fecharModalCadastroEmpresa() {
        aoFechar();
    }

    async function salvarEmpresa() {
        setCarregando(true);
        setTextoCarregamento(estaVisualizandoEmpresa ? "Atualizando empresa..." : "Cadastrando empresa...");
        setMensagemResposta("");

        try {
            await requisitarAPI("/api/empresas", {
                method: estaVisualizandoEmpresa ? "PUT" : "POST",
                body: {
                    id: formulario.id,
                    fantasia: formulario.fantasia,
                    cnpj: formulario.cnpj,
                    email: formulario.email,
                    telefone: formulario.telefone,
                    ativo: formulario.ativo,
                    exigirVinculoProduto: formulario.exigirVinculoProduto,
                },
            });

            fecharModalCadastroEmpresa();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível salvar a empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    async function cadastrarEmpresa(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await salvarEmpresa();
    }

    async function deletarEmpresa() {
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
            await requisitarAPI(`/api/empresas?id=${formulario.id}`, {
                method: "DELETE",
            });

            fecharModalCadastroEmpresa();
        } catch (erro) {
            const mensagemErro = erro instanceof Error
                ? erro.message
                : "Não foi possível excluir a empresa.";

            setMensagemResposta(mensagemErro);
        } finally {
            setCarregando(false);
        }
    }

    function obterClassesAba(aba: AbaEmpresa): string {
        const classesBase = "rounded-lg px-3 py-2 text-sm font-semibold transition";

        return abaAtiva === aba
            ? `${classesBase} bg-blue-600 text-white shadow-sm`
            : `${classesBase} bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900`;
    }

    useEffect(() => {
        if (!aberto) {
            return;
        }

        const carregamentoInicial = window.setTimeout(() => {
            if (!idEmpresa) {
                setFormulario(estadoInicialFormulario);
                setMensagemResposta("");
                return;
            }

            void carregarEmpresaSelecionada();
        }, 0);

        return () => window.clearTimeout(carregamentoInicial);
    }, [aberto, idEmpresa, carregarEmpresaSelecionada]);

    return (
        <>
            <Modal
                show={aberto}
                onHide={fecharModalCadastroEmpresa}
                onExited={limparEstadoModalCadastroEmpresa}
                centered
                size="lg"
            >
                <Modal.Header closeButton>
                    <Modal.Title className="text-lg font-bold">
                        {estaVisualizandoEmpresa ? "Empresa" : "Nova empresa"}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                        <button
                            type="button"
                            className={obterClassesAba("dados")}
                            onClick={() => setAbaAtiva("dados")}
                        >
                            Dados da empresa
                        </button>
                        <button
                            type="button"
                            className={obterClassesAba("usuarios")}
                            onClick={() => setAbaAtiva("usuarios")}
                        >
                            Usuários vinculados
                        </button>
                        <button
                            type="button"
                            className={obterClassesAba("produtos")}
                            onClick={() => setAbaAtiva("produtos")}
                        >
                            Produtos
                        </button>
                        <button
                            type="button"
                            className={obterClassesAba("regras")}
                            onClick={() => setAbaAtiva("regras")}
                        >
                            Regras
                        </button>
                    </div>

                    {abaAtiva === "dados" && (
                        <form id="formulario-cadastro-empresa" onSubmit={cadastrarEmpresa}>
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
                                    onChange={(event) => atualizarCampoFormulario("cnpj", event.target.value)}
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

                            <div className="md:col-span-12">
                                <div className="flex items-center gap-3">
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

                            <div className="md:col-span-6">
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

                            <div className="md:col-span-6">
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
                        estaVisualizandoEmpresa ? (
                            <VinculoUsuarioEmpresa
                                form="empresa"
                                idEmpresa={idEmpresa}
                                nomeContexto={formulario.fantasia}
                            />
                        ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm font-medium text-amber-800">
                                Salve a empresa antes de gerenciar usuários vinculados.
                            </div>
                        )
                    )}

                    {abaAtiva === "produtos" && (
                        <ProdutosEmpresa
                            idEmpresa={idEmpresa}
                            exigirVinculoProduto={formulario.exigirVinculoProduto}
                        />
                    )}

                    {abaAtiva === "regras" && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-base font-bold text-slate-900">Regras operacionais</h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Configure comportamentos aplicados aos fluxos da empresa.
                                </p>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start gap-3">
                                    <input
                                        id="empresa-exigir-vinculo-produto"
                                        className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        type="checkbox"
                                        checked={formulario.exigirVinculoProduto}
                                        disabled={carregando}
                                        onChange={(event) => atualizarCampoFormulario("exigirVinculoProduto", event.target.checked)}
                                    />
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <label className="text-sm font-semibold text-slate-800" htmlFor="empresa-exigir-vinculo-produto">
                                                Exigir vínculo de usuários aos produtos
                                            </label>
                                            <span
                                                className="inline-flex cursor-help text-slate-500"
                                                title="Quando habilitado, usuários de suporte visualizarão apenas os produtos vinculados a eles. Quando desabilitado, todos os usuários de suporte poderão atender todos os produtos da empresa."
                                            >
                                                <FaInfoCircle aria-hidden="true" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>

                <Modal.Footer>
                    {abaAtiva === "dados" || abaAtiva === "regras" ? (
                        <>
                        {estaVisualizandoEmpresa && (
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

                        <Botao
                            size="sm"
                            label={estaVisualizandoEmpresa ? "Salvar alterações" : "Salvar empresa"}
                            icon={<FaSave />}
                            onClick={() => {
                                if (abaAtiva === "regras") {
                                    void salvarEmpresa();
                                }
                            }}
                            disabled={carregando}
                            loading={carregando}
                            variant="outline-primary"
                            type={abaAtiva === "dados" ? "submit" : "button"}
                            className=""
                            form={abaAtiva === "dados" ? "formulario-cadastro-empresa" : undefined}
                        />
                        </>
                    ) : (
                        <Botao
                            size="sm"
                            label="Fechar"
                            icon={<FaTimes />}
                            onClick={fecharModalCadastroEmpresa}
                            disabled={carregando}
                            loading={false}
                            variant="outline-secondary"
                            type="button"
                            className=""
                        />
                    )}
                </Modal.Footer>
            </Modal>

            <ModalConfirmacao
                isOpen={aberto && modalConfirmacaoExclusaoAberto}
                message="Deseja realmente excluir esta empresa?"
                icon={<FaExclamationTriangle className="text-4xl text-red-600" />}
                onConfirm={deletarEmpresa}
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
