"use client";

import { Botao } from "@/components/inputs/button";
import { Seletor } from "@/components/inputs/select";
import { ModalCarregamento } from "@/components/modals/loading";
import { requisitarAPI } from "@/utils/api";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
    FaBars,
    FaBuilding,
    FaChevronDown,
    FaChevronRight,
    FaCog,
    FaHome,
    FaList,
    FaSignOutAlt,
    FaTimes,
    FaUserCircle,
    FaUserShield,
    FaUsers,
} from "react-icons/fa";

type MenuItem = {
    label: string;
    href?: string;
    icon: ReactNode;
    children?: MenuItem[];
};

type RecursoPermissao = "dashboard" | "usuario" | "empresa" | "configuracao" | "perfil";
type AcaoPermissao = "visualizar" | "criar" | "atualizar" | "deletar";
type PermissoesPerfil = Record<RecursoPermissao, Record<AcaoPermissao, boolean>>;

type OpcaoEmpresaUsuario = {
    label: string;
    value: string;
};

type EmpresaUsuarioSideBar = {
    id: number;
    fantasia: string;
    cnpj: string;
    ativo: boolean;
    empresaPadrao: boolean;
};

type DadosVerificacaoSideBar = {
    acessoPermitido: boolean;
    fantasiaEmpresa: string;
    permissoes: PermissoesPerfil | null;
    empresasUsuario: EmpresaUsuarioSideBar[];
};

const CHAVE_EMPRESA_NAVEGACAO = "empresaNavegacaoId";

/**
 * Item recursivo do menu lateral.
 * Use internamente na BarraLateral para renderizar links simples e grupos com filhos.
 */
function ItemMenuLateral({
    item,
    aoNavegar,
}: {
    item: MenuItem;
    aoNavegar: () => void;
}) {
    const [aberto, setAberto] = useState(false);
    const pathname = usePathname();

    const possuiFilhos = item.children && item.children.length > 0;
    const estaAtivo = item.href && pathname === item.href;

    if (!possuiFilhos) {
        return (
            <div>
                <Link
                    href={item.href || "#"}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-300 no-underline transition hover:bg-white/10 hover:text-white ${estaAtivo ? "bg-white/10 text-white" : ""}`}
                    onClick={aoNavegar}
                >
                    <span className="inline-flex w-5 items-center justify-center text-sky-400">{item.icon}</span>
                    <span>{item.label}</span>
                </Link>
            </div>
        );
    }

    return (
        <div>
            <Botao
                size="sm"
                label={item.label}
                icon={<span className="inline-flex w-5 items-center justify-center text-sky-400">{item.icon}</span>}
                iconRight={aberto ? <FaChevronDown /> : <FaChevronRight />}
                type="button"
                variant="link"
                className={`min-h-11 w-full justify-start border-transparent px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white ${aberto ? "bg-white/10 text-white" : ""}`}
                onClick={() => setAberto(!aberto)}
                disabled={false}
                loading={false}
            />

            {aberto && (
                <div className="ml-7 mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                    {item.children!.map((child) => (
                        <ItemMenuLateral
                            key={`${item.label}-${child.label}`}
                            item={child}
                            aoNavegar={aoNavegar}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Barra lateral responsiva do GSD Desk.
 * Use como base de navegação lateral em aplicações internas com menus simples ou agrupados.
 */
export default function BarraLateral() {
    const [aberta, setAberta] = useState(false);
    const [carregandoVerificacao, setCarregandoVerificacao] = useState(false);
    const [carregandoLogout, setCarregandoLogout] = useState(false);
    const [fantasiaEmpresa, setFantasiaEmpresa] = useState("GSD Desk");
    const [empresasUsuario, setEmpresasUsuario] = useState<EmpresaUsuarioSideBar[]>([]);
    const [empresaSelecionada, setEmpresaSelecionada] = useState<OpcaoEmpresaUsuario | null>(null);
    const [permissoesPerfil, setPermissoesPerfil] = useState<PermissoesPerfil | null>(null);

    const versaoApp = "1.0.0";
    const nomeEmpresaNavegacao = empresaSelecionada?.label ?? fantasiaEmpresa;
    const iniciaisEmpresa = nomeEmpresaNavegacao.trim().slice(0, 2).toUpperCase() || "GD";
    const opcoesEmpresasUsuario = empresasUsuario.map((empresa) => ({
        label: `${empresa.fantasia}${empresa.ativo ? "" : " (inativa)"}`,
        value: String(empresa.id),
    }));
    const podeVisualizarDashboard = Boolean(permissoesPerfil?.dashboard?.visualizar);
    const podeVisualizarUsuario = Boolean(permissoesPerfil?.usuario?.visualizar);
    const podeVisualizarEmpresa = Boolean(permissoesPerfil?.empresa?.visualizar);
    const podeVisualizarPerfil = Boolean(permissoesPerfil?.perfil?.visualizar);
    const podeVisualizarConfiguracao = Boolean(permissoesPerfil?.configuracao?.visualizar);

    const menusUsuario: MenuItem[] = [
        ...(podeVisualizarUsuario
            ? [{ label: "Lista de Usuários", href: "/usuarios", icon: <FaList /> }]
            : []),
        ...(podeVisualizarPerfil
            ? [{ label: "Perfis", href: "/usuarios/perfil", icon: <FaUserShield /> }]
            : []),
    ];

    const menus: MenuItem[] = [
        ...(podeVisualizarDashboard
            ? [{ label: "Dashboard", href: "/menuPrincipal", icon: <FaHome /> }]
            : []),
        ...(podeVisualizarEmpresa
            ? [{ label: "Empresas", href: "/empresas", icon: <FaBuilding /> }]
            : []),
        ...(menusUsuario.length > 0
            ? [{
                label: "Usuários",
                icon: <FaUsers />,
                children: menusUsuario,
            }]
            : []),
        ...(podeVisualizarConfiguracao
            ? [{ label: "Configurações", href: "/configuracoes", icon: <FaCog /> }]
            : []),
    ];

    function abrirBarraLateral() {
        setAberta(true);
    }

    function fecharBarraLateral() {
        setAberta(false);
    }

    /**
     * Atualiza a empresa de navegação no estado local e persiste a escolha para as próximas telas.
     */
    function selecionarEmpresaNavegacao(opcao: OpcaoEmpresaUsuario | null) {
        if (!opcao) {
            return;
        }

        setEmpresaSelecionada(opcao);
        localStorage.setItem(CHAVE_EMPRESA_NAVEGACAO, opcao.value);
        window.location.reload();
    }

    /**
     * Encerra a sessão no servidor e redireciona o usuário para a tela inicial.
     */
    async function realizarLogoffUsuario() {
        setCarregandoLogout(true);

        try {
            await requisitarAPI("/api/auth/logout", {
                method: "POST",
            });
        } finally {
            window.location.assign("/");
        }
    }

    /**
     * Confirma se o usuário logado ainda pode acessar a área interna e carrega permissões do perfil.
     */
    const verificarAcessoAreaInterna = useCallback(async () => {
        setCarregandoVerificacao(true);

        try {
            const resposta = await requisitarAPI("/api/sideBar", {
                method: "GET",
            });

            const dados = resposta.dados as DadosVerificacaoSideBar | null;
        
            if (!dados?.acessoPermitido) {
                window.location.assign("/");
                return;
            }

            if (dados.fantasiaEmpresa) {
                setFantasiaEmpresa(dados.fantasiaEmpresa);
            }

            const empresasVinculadas = dados.empresasUsuario ?? [];
            const idEmpresaLocalStorage = localStorage.getItem(CHAVE_EMPRESA_NAVEGACAO);
            const empresaLocalStorage = empresasVinculadas.find((empresa) => String(empresa.id) === idEmpresaLocalStorage);
            const empresaPadrao = empresasVinculadas.find((empresa) => empresa.empresaPadrao);
            const primeiraEmpresa = empresasVinculadas[0];
            const empresaInicial = empresaLocalStorage ?? empresaPadrao ?? primeiraEmpresa;

            setEmpresasUsuario(empresasVinculadas);
            if (empresaInicial) {
                const opcaoEmpresaInicial = {
                    label: `${empresaInicial.fantasia}${empresaInicial.ativo ? "" : " (inativa)"}`,
                    value: String(empresaInicial.id),
                };

                setEmpresaSelecionada(opcaoEmpresaInicial);
                localStorage.setItem(CHAVE_EMPRESA_NAVEGACAO, opcaoEmpresaInicial.value);
            } else {
                setEmpresaSelecionada(null);
                localStorage.removeItem(CHAVE_EMPRESA_NAVEGACAO);
            }
            setPermissoesPerfil(dados.permissoes);
        } catch {
            window.location.assign("/");
        } finally {
            setCarregandoVerificacao(false);
        }
    }, []);

    useEffect(() => {
        const verificacaoInicial = window.setTimeout(() => {
            void verificarAcessoAreaInterna();
        }, 0);

        return () => window.clearTimeout(verificacaoInicial);
    }, [verificarAcessoAreaInterna]);

    return (
        <>
            <nav className="fixed inset-x-0 top-0 z-[1030] flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
                <Botao
                    size="sm"
                    icon={<FaBars />}
                    type="button"
                    variant="link"
                    className="h-10 w-10 border-slate-200 bg-white p-0 text-slate-900 hover:bg-slate-50"
                    onClick={abrirBarraLateral}
                    disabled={false}
                    loading={false}
                    ariaLabel={aberta ? "Menu aberto" : "Abrir menu"}
                />

                <span className="font-bold text-slate-900">{nomeEmpresaNavegacao}</span>
            </nav>

            {aberta && (
                <Botao
                    size="sm"
                    type="button"
                    variant="link"
                    className="fixed inset-0 z-[1040] h-full w-full rounded-none border-0 bg-slate-950/60 p-0 hover:bg-slate-950/60"
                    onClick={fecharBarraLateral}
                    disabled={false}
                    loading={false}
                    ariaLabel="Fechar menu"
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-[1050] flex w-[min(18rem,calc(100vw-2rem))] flex-col bg-slate-950 p-4 text-slate-100 shadow-2xl shadow-slate-950/30 transition-transform duration-200 ${aberta ? "translate-x-0" : "-translate-x-[105%]"}`}>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 font-extrabold text-white">{iniciaisEmpresa}</span>
                        <div>
                            <strong>{nomeEmpresaNavegacao}</strong>
                        </div>
                    </div>

                    <Botao
                        size="sm"
                        icon={<FaTimes />}
                        type="button"
                        variant="link"
                        className="h-10 w-10 border-white/10 bg-white/5 p-0 text-slate-100 hover:bg-white/10"
                        onClick={fecharBarraLateral}
                        disabled={false}
                        loading={false}
                        ariaLabel="Fechar menu"
                    />
                </div>

                <div className="border-b border-white/10 py-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-300" htmlFor="sidebar-empresa-navegacao">
                        Empresa de navegação
                    </label>

                    <Seletor
                        id="sidebar-empresa-navegacao"
                        label=""
                        options={opcoesEmpresasUsuario}
                        value={empresaSelecionada}
                        onChange={selecionarEmpresaNavegacao}
                        placeholder="Selecione uma empresa"
                        isDisabled={carregandoVerificacao || opcoesEmpresasUsuario.length <= 1}
                        isClearable={false}
                        className="w-full"
                    />
                </div>

                <nav className="flex flex-col gap-1 py-4">
                    {menus.map((item) => (
                        <ItemMenuLateral
                            key={item.label}
                            item={item}
                            aoNavegar={fecharBarraLateral}
                        />
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4 text-sm text-slate-400">
                    <Botao
                        size="sm"
                        label="Minha conta"
                        icon={<span className="inline-flex w-5 items-center justify-center text-sky-400"><FaUserCircle /></span>}
                        type="button"
                        variant="link"
                        className="min-h-10 w-full justify-start border-transparent px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
                        onClick={() => {
                            fecharBarraLateral();
                            window.location.assign("/minhaConta");
                        }}
                        disabled={carregandoLogout}
                        loading={false}
                    />

                    <Botao
                        size="sm"
                        label="Sair"
                        icon={<span className="inline-flex w-5 items-center justify-center text-sky-400"><FaSignOutAlt /></span>}
                        type="button"
                        variant="link"
                        className="min-h-10 w-full justify-start border-transparent px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white"
                        onClick={realizarLogoffUsuario}
                        disabled={carregandoLogout}
                        loading={false}
                    />

                    <div className="flex items-center justify-between">
                        <span>Versão</span>
                        <strong className="text-slate-100">v{versaoApp}</strong>
                    </div>
                </div>
            </aside>

            <ModalCarregamento
                show={carregandoVerificacao || carregandoLogout}
                text={carregandoLogout ? "Encerrando sessão..." : "Verificando acesso..."}
            />
        </>
    );
}
