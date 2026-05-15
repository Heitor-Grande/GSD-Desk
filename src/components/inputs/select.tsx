"use client";

import ReactSelect from "react-select";

interface Option {
    label: string;
    value: string;
};

interface SelectProps {
    id: string;
    label: string;
    options: Option[];
    value: Option | null;
    onChange: (option: Option | null) => void;
    placeholder: string;
    isDisabled: boolean;
    isClearable: boolean;
    className: string;
};

/**
 * Seletor controlado baseado em react-select.
 * Use quando a tela precisar de opcoes pesquisaveis, limpaveis ou com experiencia melhor que um select nativo.
 */
export function Seletor({
    id,
    label,
    options,
    value,
    onChange,
    placeholder,
    isDisabled,
    isClearable,
    className
}: SelectProps) {
    return (
        <div className={className}>
            {label && <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>}

            <ReactSelect
                instanceId={id}
                inputId={id}
                options={options}
                value={value}
                onChange={(selected) => onChange?.(selected as Option | null)}
                placeholder={placeholder}
                isDisabled={isDisabled}
                isClearable={isClearable}
                classNames={{
                    control: (estado) => [
                        "!min-h-10 !rounded-lg !border-slate-300 !shadow-sm",
                        estado.isFocused ? "!border-blue-500 !ring-2 !ring-blue-100" : "",
                        estado.isDisabled ? "!bg-slate-100" : "!bg-white",
                    ].join(" "),
                    valueContainer: () => "!px-3 !py-0",
                    input: () => "!text-slate-900",
                    singleValue: () => "!text-slate-900",
                    placeholder: () => "!text-slate-400",
                    menu: () => "!z-[1060] !rounded-lg !border !border-slate-200 !shadow-xl",
                    option: (estado) => [
                        estado.isFocused ? "!bg-blue-50" : "",
                        estado.isSelected ? "!bg-blue-600 !text-white" : "!text-slate-700",
                    ].join(" "),
                }}
            />
        </div>
    );
}
