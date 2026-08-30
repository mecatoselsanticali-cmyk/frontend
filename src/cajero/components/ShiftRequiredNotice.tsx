import { usePosStore } from "../store/posStore";

/**
 * Reemplaza el contenido real de Caja/Facturas/Compras mientras el cajero
 * no tiene un turno abierto — a diferencia del overlay bloqueante anterior
 * (ver punto 32 de CLAUDE.md, ahora reemplazado), esto NO impide navegar
 * entre pestañas ni cerrar sesión: cada página simplemente muestra este
 * aviso en vez de sus datos reales hasta que se abre un turno.
 * `CashierLayout.tsx` ya abre `ShiftModal` automáticamente al detectar que
 * no hay turno — el botón de acá es solo para reabrirlo si el cajero lo
 * cerró sin completar la apertura.
 */
export default function ShiftRequiredNotice() {
  const openModal = usePosStore((s) => s.openModal);

  return (
    <div className="h-full w-full flex items-center justify-center bg-neutral-50">
      <div className="text-center max-w-sm p-8">
        <div className="text-4xl mb-3">🧾</div>
        <h2 className="text-lg font-bold text-neutral-800 mb-2">Turno no iniciado</h2>
        <p className="text-sm text-neutral-500 mb-6">
          Abre tu turno para ver esta información y empezar a operar.
        </p>
        <button
          onClick={() => openModal("SHIFT")}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl text-base"
        >
          Iniciar turno
        </button>
      </div>
    </div>
  );
}
