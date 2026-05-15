import BarraLateral from "@/components/layout/sideBar";

/**
 * Layout da area autenticada.
 * Use para manter a barra lateral fixa em todas as telas internas sem repetir o componente nas paginas.
 */
export default function LayoutAreaAutenticada({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-[#f4f7fb]">
            <BarraLateral />

            <main className="min-h-screen px-4 pb-8 pt-20 lg:px-8">
                {children}
            </main>
        </div>
    );
}
