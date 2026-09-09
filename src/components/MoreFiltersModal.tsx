import type { ReactNode } from "react";

interface MoreFiltersModalProps {
  onClose: () => void;
  // Resetea TODOS los filtros de la página (incluido el buscador, que
  // vive fuera de este modal) a su valor por defecto — opcional para no
  // romper un consumidor futuro que no lo necesite, pero las 7 páginas
  // actuales (ver punto 63 de CLAUDE.md) siempre lo pasan.
  onClear?: () => void;
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
 * que el resto de filtros de este panel), así que "Ver resultados" es
 * solo para cerrar, no para confirmar nada.
 *
 * "Limpiar filtros" NO cierra el modal — a propósito, para que el admin
 * vea los campos volver a su valor por defecto ahí mismo (los `<select>`/
 * `<input>` reflejan el nuevo estado al instante, mismo `value` que ya
 * tenían) antes de decidir si quiere ajustar algo más o cerrar con "Ver
 * resultados" — mismo criterio de "no cerrar de golpe tras una acción
 * destructiva" que el resto de confirmaciones de este panel (ver
 * `Swal.fire` con `showCancelButton` en las páginas que lo usan).
 */
export default function MoreFiltersModal({ onClose, onClear, children }: MoreFiltersModalProps) {
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

        <div className="p-5 pt-4 border-t border-neutral-100 shrink-0 flex gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg py-2 text-sm font-medium"
            >
              Limpiar filtros
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </div>
  );
}
