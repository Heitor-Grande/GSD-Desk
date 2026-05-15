"use client";

import { Botao } from "@/components/inputs/button";
import { CampoTexto } from "@/components/inputs/input";
import { ModalCarregamento } from "@/components/modals/loading";
import ModalResposta from "@/components/modals/responseModal";
import { requisitarAPI } from "@/utils/api";
import ModalRecSenha from "./components/modalRecSenha";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaCheckCircle,
  FaClipboardList,
  FaComments,
  FaHeadset,
  FaHistory,
  FaRegClock,
  FaShieldAlt,
} from "react-icons/fa";

/**
 * Página inicial com apresentação do GSD Desk e formulário de login.
 * Use para autenticar o usuário sem alterar o fluxo de sessão da aplicação.
 */
export default function PaginaInicial() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [modalRecSenhaAberto, setModalRecSenhaAberto] = useState(false);

  /**
   * Envia as credenciais para a API de login e exibe a resposta sem manipular tokens no front.
   */
  async function enviarFormularioLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setLoginMessage("");

    try {
      await requisitarAPI("/api/auth/login", {
        method: "POST",
        body: {
          email,
          password,
        },
      });

      setPassword("");
      router.push("/menuPrincipal");
    } catch (erro) {
      const mensagemErro = erro instanceof Error
        ? erro.message
        : "Não foi possível conectar ao servidor.";

      setLoginMessage(mensagemErro);
    } finally {
      setLoading(false);
    }
  }

  const beneficios = [
    { texto: "Organização das demandas", icone: <FaClipboardList /> },
    { texto: "Acompanhamento de status", icone: <FaRegClock /> },
    { texto: "Histórico dos atendimentos", icone: <FaHistory /> },
    { texto: "Priorização de solicitações", icone: <FaShieldAlt /> },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#172033]">
      <section className="flex min-h-screen items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-2xl border border-[#dce3ec] bg-white shadow-2xl shadow-slate-200/80 lg:min-h-[42rem] lg:grid-cols-[1.12fr_0.88fr]">
          <div className="relative flex flex-col justify-between overflow-hidden bg-[#111827] px-6 py-8 text-[#e5edf8] sm:px-10 lg:px-12">
            <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_22%_18%,rgba(96,165,250,0.34),transparent_32%),radial-gradient(circle_at_78%_6%,rgba(13,110,253,0.22),transparent_30%)]" />

            <div className="relative">
              <div className="mb-12 inline-flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-950/30">
                  <FaHeadset />
                </span>
                <div>
                  <p className="text-lg font-bold text-white">GSD Desk</p>
                  <p className="text-sm text-[#94a3b8]">Solicitações e suporte</p>
                </div>
              </div>

              <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Organize tickets, solicitações e atendimentos de suporte em um só lugar.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-[#cbd5e1] sm:text-lg">
                O GSD Desk ajuda equipes a registrar demandas, acompanhar cada etapa do atendimento e manter a comunicação clara entre solicitantes e suporte.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {beneficios.map((beneficio) => (
                  <div
                    key={beneficio.texto}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-[#60a5fa]">
                      {beneficio.icone}
                    </span>
                    <span className="text-sm font-semibold text-[#e5edf8]">
                      {beneficio.texto}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-10 rounded-xl border border-white/10 bg-white/[0.07] p-5">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                  <FaComments />
                </span>
                <div>
                  <p className="font-bold text-white">Comunicação mais clara</p>
                  <p className="mt-1 text-sm leading-6 text-[#cbd5e1]">
                    Centralize conversas, prioridades e registros para reduzir ruído entre quem solicita e quem atende.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div id="login" className="flex items-center px-6 py-8 sm:px-10 lg:px-12">
            <div className="w-full">
              <div className="mb-8">
                <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                  <FaCheckCircle />
                </span>
                <p className="text-xs font-bold uppercase text-[#6c757d]">
                  Área segura
                </p>
                <h2 className="mt-1 text-3xl font-extrabold text-[#172033]">
                  Acesse sua conta
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#6c757d]">
                  Entre para acompanhar solicitações, atualizar atendimentos e consultar o histórico do suporte.
                </p>
              </div>

              <form onSubmit={enviarFormularioLogin}>
                <CampoTexto
                  id="email"
                  label="E-mail"
                  type="email"
                  value={email}
                  placeholder="email@empresa.com"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setLoginMessage("");
                  }}
                  disabled={loading}
                  required
                  className="mb-4"
                />

                <CampoTexto
                  id="password"
                  label="Senha"
                  type="password"
                  value={password}
                  placeholder="Digite sua senha"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setLoginMessage("");
                  }}
                  disabled={loading}
                  required
                  className="mb-2"
                />

                <div className="mb-5 flex justify-end">
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-sm font-semibold text-blue-700 transition hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setModalRecSenhaAberto(true)}
                    disabled={loading}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Botao
                  size="lg"
                  label="Entrar"
                  onClick={() => undefined}
                  disabled={loading}
                  loading={false}
                  variant="primary"
                  type="submit"
                  className="w-full"
                />
              </form>

              <div className="mt-6 rounded-xl border border-[#dce3ec] bg-[#f4f7fb] p-4">
                <p className="mb-1 text-sm font-bold text-[#273142]">
                  Plataforma para suporte estruturado
                </p>
                <p className="text-sm leading-6 text-[#6c757d]">
                  Cada solicitação fica registrada com contexto, status e histórico para facilitar decisões e próximos passos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ModalResposta
        isOpen={Boolean(loginMessage)}
        message={loginMessage}
        onClose={() => setLoginMessage("")}
      />

      <ModalCarregamento
        show={loading}
        text="Validando suas credenciais..."
      />

      <ModalRecSenha
        isOpen={modalRecSenhaAberto}
        onClose={() => setModalRecSenhaAberto(false)}
      />
    </div>
  );
}
