import { money } from "./SaleReceipt";
import LogoLoader from "../../components/LogoLoader";
import { CREATE_SALE_TIMEOUT_MS } from "../dianPolling";

interface ProcessingSaleModalProps {
  total: number;
}

/**
 * Pantalla intermedia entre tocar "Cobrar" y que exista una venta real —
 * antes de esto, el único indicio de que algo estaba pasando era el botón
 * "Cobrar" deshabilitado con el texto "Procesando...", fácil de pasar por
 * alto en una pantalla táctil. `PaymentPanel.tsx` la muestra mientras
 * `processing` es true (POST /api/pos/sales en vuelo), y la reemplaza en el
 * mismo render por `EmittingReceipt`/`SaleReceipt` apenas la venta existe —
 * nunca se solapan.
 *
 * A propósito SIN botón de salida (a diferencia de `EmittingReceipt.tsx`) —
 * acá todavía no hay ninguna venta real que mostrar igual si el cajero se
 * cansa de esperar, así que no hay nada útil a lo que "saltar". Por el
 * mismo motivo, la barra de progreso de abajo NO lleva el texto "mostramos
 * el recibo igual" que sí tiene `EmittingReceipt.tsx` — acá, si se agota
 * `CREATE_SALE_TIMEOUT_MS`, el request de axios falla con un timeout real
 * (`saleError` en `PaymentPanel.tsx`), no hay un estado parcial que mostrar.
 */
export default function ProcessingSaleModal({ total }: ProcessingSaleModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <style>{`
        @keyframes processing-sale-progress {
          from { width: 4%; }
          to { width: 100%; }
        }
      `}</style>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-8 text-center">
        <div className="h-full w-full flex items-center justify-center">
          <LogoLoader text="Procesando venta..." />
        </div>
        <p className="text-xs text-neutral-500 mb-5 max-w-[26ch] mx-auto">
          Estamos registrando la venta, un momento.
        </p>
        <div className="h-1 rounded-full bg-neutral-100 overflow-hidden mb-5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
            style={{ animation: `processing-sale-progress ${CREATE_SALE_TIMEOUT_MS}ms linear forwards` }}
          />
        </div>
        <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-neutral-500">Total</span>
          <span className="font-bold">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}
