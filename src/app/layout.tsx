import type { Metadata } from "next";
import "./cssGlobal.css";
import "quill/dist/quill.snow.css";

export const metadata: Metadata = {
  title: "GSD Desk",
  description: "Sistema de tickets e solicitações para suporte.",
};

/**
 * Layout raiz da aplicação.
 * Use para imports globais, metadados e estrutura comum compartilhada por todas as rotas.
 */
export default function LayoutRaiz({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" data-scroll-behavior="smooth">
      <body>
        <div className="flex">

          {/* Conteúdo dinâmico da rota atual. */}
          <main className="min-w-0 flex-1 p-0">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}
