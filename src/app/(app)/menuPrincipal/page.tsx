/**
 * Pagina principal apos login.
 * Use como primeira tela autenticada do template e ponto de entrada para menus internos.
 */
export default function PaginaMenuPrincipal() {
    return (
        <div className="w-full">
            <h1 className="text-2xl font-bold text-slate-900">Menu principal</h1>
            <p className="mb-0 mt-2 text-slate-500">
                Selecione uma opção no menu lateral para iniciar.
            </p>
        </div>
    );
}
