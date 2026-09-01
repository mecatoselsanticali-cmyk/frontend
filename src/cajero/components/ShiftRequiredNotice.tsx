import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
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
 *
 * Estilo alineado con `MobileBlockScreen.tsx` (mismo patrón de tarjeta
 * oscura translúcida + badge de ícono en degradé de marca) — a diferencia
 * de esa pantalla, esta vive DENTRO del área de contenido ya blanca de
 * `CashierLayout`, no reemplaza el viewport completo, así que el fondo con
 * resplandores queda contenido al panel en vez de ser a pantalla completa.
 * Entrada con fade+slide vía `requestAnimationFrame`, mismo patrón que
 * `GlassCard` en `components/AuthShell.tsx`.
 */
export default function ShiftRequiredNotice() {
  const openModal = usePosStore((s) => s.openModal);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative h-full w-full flex items-center justify-center overflow-hidden bg-neutral-50 px-4">
      <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl bg-brand-200/40" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 w-80 h-80 rounded-full blur-3xl bg-red-200/30" />

      <div className="relative w-full max-w-sm flex flex-col items-center">
        <img
          src="/img/logo-santi-trimmed.webp"
          alt="Mecatos el Santi"
          draggable={false}
          className="w-32 sm:w-36 select-none drop-shadow-[0_0_30px_rgba(234,88,12,0.25)]"
        />
        <p className="mt-1 text-sm text-neutral-500">Comidas · Punto de venta</p>

        <div
          className={`mt-6 w-full bg-neutral-900/70 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 flex flex-col items-center text-center gap-4 transition-all duration-500 ${
            entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40">
            <Clock size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Turno no iniciado</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Abre tu turno para ver esta información y empezar a operar.
            </p>
          </div>
          <button
            onClick={() => openModal("SHIFT")}
            className="w-full bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white font-bold py-3 rounded-xl text-base shadow-lg shadow-brand-900/40 transition-all"
          >
            Iniciar turno
          </button>
        </div>
      </div>
    </div>
  );
}
