"use client";

import BarraLateral from "@/components/layout/sideBar";
import { useState } from "react";

/**
 * Layout da area autenticada.
 * Use para manter a barra lateral fixa em todas as telas internas sem repetir o componente nas paginas.
 */
export default function LayoutAreaAutenticada({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [barraLateralAberta, setBarraLateralAberta] = useState(() => (
        typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches
    ));

    return (
        <div className="min-h-screen bg-[#f4f7fb]">
            <BarraLateral
                aberta={barraLateralAberta}
                aoAbrir={() => setBarraLateralAberta(true)}
                aoFechar={() => setBarraLateralAberta(false)}
            />

            <main className={`min-h-screen px-4 pb-8 pt-20 transition-[padding] duration-200 lg:pr-8 ${barraLateralAberta ? "lg:pl-80" : "lg:pl-8"}`}>
                {children}
            </main>
        </div>
    );
}
