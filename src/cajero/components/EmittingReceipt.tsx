import { money } from "./SaleReceipt";
import LogoLoader from "../../components/LogoLoader";
import { DIAN_POLL_INTERVAL_MS, DIAN_POLL_MAX_ATTEMPTS } from "../dianPolling";

interface EmittingReceiptProps {
  total: number;
  ticketId: string;
  onSkip: () => void;
}

// Mismo tope real que usa el polling de PaymentPanel.tsx — nunca un número
// aparte hardcodeado acá, para que la barra de progreso no se desincronice
// si ese tope cambia.
const TOTAL_WAIT_MS = DIAN_POLL_INTERVAL_MS * DIAN_POLL_MAX_ATTEMPTS;
const TOTAL_WAIT_SECONDS = Math.round(TOTAL_WAIT_MS / 1000);

/**
 * Pantalla intermedia entre "Cobrar" y el recibo real, solo para ventas
 * `category: "SPECIAL"` (ver punto 37 de backend/CLAUDE.md) — PaymentPanel.tsx
 * la muestra mientras hace polling de GET /api/pos/sales/:id/status, en vez
 * de mostrar el recibo de inmediato con `dianStatus: "PENDING"`.
 *
 * A propósito NO bloquea sin salida (mismo principio del punto 31 de
 * src/cajero/CLAUDE.md: aviso, nunca atrapado) — "Ver recibo de todas
 * formas" corta la espera manualmente, igual que el timeout automático de
 * ~15s en PaymentPanel.tsx. La barra de progreso de abajo es puramente
 * informativa (se anima una sola vez al montar, sin sincronizarse con el
 * polling real) — si el polling resuelve antes de que termine, el modal
 * se desmonta y la barra desaparece a mitad de camino, sin problema.
 */
export default function EmittingReceipt({ total, ticketId, onSkip }: EmittingReceiptProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <style>{`
        @keyframes emitting-receipt-progress {
          from { width: 4%; }
          to { width: 100%; }
        }
      `}</style>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-8 text-center">
        <LogoLoader text="Emitiendo factura ante la DIAN…" />
        <p className="text-xs text-neutral-500 mb-5 max-w-[26ch] mx-auto">
          Estamos confirmando esta venta con Siigo. El recibo aparece apenas llegue el CUFE.
        </p>
        <div className="h-1 rounded-full bg-neutral-100 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
            style={{ animation: `emitting-receipt-progress ${TOTAL_WAIT_MS}ms linear forwards` }}
          />
        </div>
        <p className="text-[10px] text-neutral-400 mb-5">
          Si tarda más de {TOTAL_WAIT_SECONDS} segundos, mostramos el recibo igual — la venta ya
          quedó registrada.
        </p>
        <div className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 flex items-center justify-between text-sm mb-5">
          <span className="text-neutral-500">Ticket {ticketId}</span>
          <span className="font-bold">{money(total)}</span>
        </div>
        <button
          onClick={onSkip}
          className="text-xs text-neutral-400 hover:text-neutral-600 underline underline-offset-2"
        >
          Ver recibo de todas formas
        </button>
      </div>
    </div>
  );
}
