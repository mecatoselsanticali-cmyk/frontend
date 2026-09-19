import { Loader2 } from "lucide-react";
import { money } from "./SaleReceipt";

interface EmittingReceiptProps {
  total: number;
  ticketId: string;
  onSkip: () => void;
}

/**
 * Pantalla intermedia entre "Cobrar" y el recibo real, solo para ventas
 * `category: "SPECIAL"` (ver punto 37 de backend/CLAUDE.md) — PaymentPanel.tsx
 * la muestra mientras hace polling de GET /api/pos/sales/:id/status, en vez
 * de mostrar el recibo de inmediato con `dianStatus: "PENDING"`.
 *
 * A propósito NO bloquea sin salida (mismo principio del punto 31 de
 * src/cajero/CLAUDE.md: aviso, nunca atrapado) — "Ver recibo de todas
 * formas" corta la espera manualmente, igual que el timeout automático de
 * ~15s en PaymentPanel.tsx.
 */
export default function EmittingReceipt({ total, ticketId, onSkip }: EmittingReceiptProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Loader2 size={26} className="text-white animate-spin" />
        </div>
        <h2 className="font-bold text-base mb-1">Emitiendo factura ante la DIAN…</h2>
        <p className="text-xs text-neutral-500 mb-5 max-w-[26ch] mx-auto">
          Estamos confirmando esta venta con Siigo. El recibo aparece apenas llegue el CUFE.
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
