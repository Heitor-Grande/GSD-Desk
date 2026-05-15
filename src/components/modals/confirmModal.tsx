"use client";

import { ReactNode } from "react";
import { Modal } from "react-bootstrap";
import { Botao } from "../inputs/button";

interface ConfirmModalProps {
    isOpen: boolean;
    message: string;
    icon: ReactNode;

    onConfirm: () => void;
    onCancel: () => void;

    confirmLabel: string;
    cancelLabel: string;
}

/**
 * Modal generico de confirmacao.
 * Use antes de acoes destrutivas ou irreversiveis, delegando a regra de negocio para onConfirm/onCancel.
 */
export default function ModalConfirmacao({
    isOpen,
    message,
    icon,

    onConfirm,
    onCancel,

    confirmLabel,
    cancelLabel,
}: ConfirmModalProps) {
    return (
        <Modal show={isOpen} onHide={onCancel} centered size="sm">
            <Modal.Body className="px-6 pt-6 text-center">
                <div className="space-y-3">
                    {icon && (
                        <div className="flex justify-center text-4xl text-red-600">
                            {icon}
                        </div>
                    )}
                    <p className="mb-0 font-bold text-slate-800">
                        {message}
                    </p>
                </div>
            </Modal.Body>

            <Modal.Footer className="grid grid-cols-1 gap-2 border-0 px-6 pb-6 pt-4 sm:grid-cols-2">
                <Botao
                    size="sm"
                    label={cancelLabel}
                    onClick={onCancel}
                    disabled={false}
                    loading={false}
                    variant="primary"
                    type="button"
                    className="w-full"
                />
                <Botao
                    size="sm"
                    label={confirmLabel}
                    onClick={onConfirm}
                    disabled={false}
                    loading={false}
                    variant="danger"
                    type="button"
                    className="w-full"
                />
            </Modal.Footer>
        </Modal>
    );
}
