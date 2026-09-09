import type { ReactNode } from "react";

interface MoreFiltersModalProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal genérico "Más filtros" para la vista de celular de las páginas con
 * filtros del panel admin (Ventas, Inventario, Compras, Gastos, Personal,
 * Sedes, FinanzasCaja — ver punto 63 de CLAUDE.md). En escritorio, todos
 * los filtros de cada página siguen visibles en su fila de siempre, sin
 * cambios; en celular solo el filtro de búsqueda (si la página tiene uno)
 * queda visible junto al botón "Más filtros" que abre este modal con el
 * resto.
 *
 * No es un formulario con botón "Aplicar" — cada control adentro sigue
 * atado directamente al mismo estado que ya dispara la recarga vía
 * `useEffect` en la página que lo use (mismo patrón sin botón "Aplicar"
 * que el resto de filtros de este panel), así que el único botón del
 * footer es para cerrar, no para confirmar nada.
 */
export default function MoreFiltersModal({ onClose, children }: MoreFiltersModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 pb-4 border-b border-neutral-100 shrink-0">
          <h3 className="text-lg font-bold">Más filtros</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>

        <div className="p-5 pt-4 border-t border-neutral-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}
