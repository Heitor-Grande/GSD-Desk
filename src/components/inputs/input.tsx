"use client";

import { ChangeEvent } from "react";

interface InputProps {
    id: string;
    label: string;
    type: string;
    value: string;
    placeholder: string;
    onChange: (value: ChangeEvent<HTMLInputElement, HTMLInputElement>) => void;
    disabled: boolean;
    required: boolean;
    className: string;
    helpText?: string;
    classNameHelpText?: string;
    classNameInput?: string;
    labelVisivel?: boolean;
};

/**
 * Campo de texto controlado do template.
 * Use em formularios para padronizar label, estado desabilitado, obrigatoriedade e texto de ajuda.
 */
export function CampoTexto({
    id,
    label,
    type,
    value,
    placeholder,
    onChange,
    disabled,
    required,
    className,
    helpText,
    classNameHelpText = "mt-1 block text-sm text-slate-500",
    classNameInput = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
    labelVisivel = true,
}: InputProps) {
    return (
        <div className={className}>

            {labelVisivel && (
                <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
                    {label}
                </label>
            )}

            <input
                type={type}
                className={classNameInput}
                id={id}
                aria-label={!labelVisivel ? label : undefined}
                placeholder={placeholder}
                value={value}
                disabled={disabled}
                required={required}
                onChange={(e) => onChange(e)}
            />

            {
                helpText && (
                    <small className={classNameHelpText}>
                        {helpText}
                    </small>
                )
            }
        </div>
    );
}
