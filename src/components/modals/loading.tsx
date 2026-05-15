"use client";

import { Modal } from "react-bootstrap";

interface LoadingModalProps {
    show: boolean;
    text?: string;
}

/**
 * Modal bloqueante de carregamento.
 * Use durante chamadas de API ou processos assincronos para impedir nova interacao ate a conclusao.
 */
export function ModalCarregamento({
    show,
    text = "Processando solicitacao...",
}: LoadingModalProps) {
    return (
        <Modal
            show={show}
            centered
            backdrop="static"
            keyboard={false}
            size="sm"
            contentClassName="loading-modal border-0 rounded-xl shadow-2xl"
        >
            <Modal.Body className="px-6 py-8 text-center">
                <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" role="status" aria-hidden="true" />
                </div>

                <p className="mb-1 text-lg font-bold text-slate-800">Aguarde</p>
                <p className="mb-0 text-sm leading-relaxed text-slate-500">{text}</p>
            </Modal.Body>
        </Modal>
    );
}
