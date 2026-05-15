"use client";

import { Modal } from "react-bootstrap";
import { FaInfoCircle } from "react-icons/fa";
import { Botao } from "../inputs/button";

interface ResponseModalProps {
    isOpen: boolean;
    message: string;
    title?: string;
    onClose: () => void;
};

/**
 * Modal genérico de resposta ao usuário.
 * Use para exibir mensagens de sucesso, erro ou aviso retornadas por fluxos da aplicação.
 */
export default function ModalResposta({
    isOpen,
    message,
    title = "Aviso",
    onClose,
}: ResponseModalProps) {

    return (
        <Modal show={isOpen} onHide={onClose} centered size="sm" contentClassName="response-modal border-0 rounded-xl shadow-2xl">
            <Modal.Header closeButton className="border-b border-slate-100 px-5 py-4">
                <Modal.Title className="text-lg font-bold">{title}</Modal.Title>
            </Modal.Header>

            <Modal.Body className="px-6 pb-5 pt-7 text-center">
                <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-2xl text-blue-600">
                    <FaInfoCircle />
                </span>

                <p className="mb-0 text-base font-semibold leading-relaxed text-slate-800">
                    {message}
                </p>
            </Modal.Body>

            <Modal.Footer className="border-0 px-6 pb-6 pt-0">
                <Botao
                    size="sm"
                    label="Ok"
                    onClick={onClose}
                    disabled={false}
                    loading={false}
                    variant="primary"
                    type="button"
                    className="w-full"
                />
            </Modal.Footer>
        </Modal>
    );
}
