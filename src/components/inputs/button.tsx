"use client";

import { ReactNode } from "react";

type ButtonProps = {
    size: "sm" | "lg"
    label?: string;
    icon?: ReactNode;
    iconRight?: ReactNode;
    onClick: () => void;
    disabled: boolean;
    loading: boolean;
    variant: string;
    type: "button" | "submit" | "reset";
    className: string;
    ariaLabel?: string;
    form?: string;
};

/**
 * Botao base do template.
 * Use para manter botões Bootstrap com suporte padrão a ícone, loading e estado desabilitado.
 */
export function Botao({
    size,
    label,
    icon,
    iconRight,
    onClick,
    disabled,
    loading,
    variant,
    type,
    className,
    ariaLabel,
    form,
}: ButtonProps) {
    const classesPorTamanho = {
        sm: "min-h-9 px-3 py-2 text-sm",
        lg: "min-h-12 px-5 py-3 text-base",
    };

    const classesPorVariacao: Record<string, string> = {
        primary: "border-blue-600 bg-blue-600 text-white shadow-sm hover:border-blue-700 hover:bg-blue-700",
        "outline-primary": "border-blue-600 bg-white text-blue-700 hover:border-blue-700 hover:bg-blue-700 hover:text-white",
        secondary: "border-slate-600 bg-slate-600 text-white hover:bg-slate-700",
        "outline-secondary": "border-slate-300 bg-white text-slate-700 hover:border-slate-700 hover:bg-slate-700 hover:text-white",
        danger: "border-red-600 bg-red-600 text-white shadow-sm hover:border-red-700 hover:bg-red-700",
        "outline-danger": "border-red-500 bg-white text-red-700 hover:border-red-700 hover:bg-red-700 hover:text-white",
        success: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
        "outline-success": "border-emerald-600 bg-white text-emerald-700 hover:border-emerald-700 hover:bg-emerald-700 hover:text-white",
        link: "border-transparent bg-transparent text-blue-700 shadow-none hover:bg-blue-700 hover:text-white",
    };

    const classesBase = [
        "inline-flex cursor-pointer items-center justify-center rounded-lg border font-semibold leading-none transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        "disabled:cursor-not-allowed disabled:opacity-60",
        classesPorTamanho[size],
        classesPorVariacao[variant] ?? classesPorVariacao.primary,
        className,
    ].filter(Boolean).join(" ");

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            type={type}
            className={classesBase}
            aria-label={ariaLabel}
            form={form}
        >
            <span className="inline-flex w-full items-center justify-center gap-2">
                {icon && <span className="inline-flex items-center">{icon}</span>}
                {label && <span>{label}</span>}
                {iconRight && <span className="ml-auto inline-flex items-center">{iconRight}</span>}
            </span>
        </button>
    );
}
