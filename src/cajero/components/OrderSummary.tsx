import { usePosStore } from "../store/posStore";
import { paymentMethodLabels, money } from "./SaleReceipt";

interface OrderSummaryProps {
  selectedMethod: string | null;
  isDidi: boolean;
}

/**
 * Recapitulación de solo lectura del pedido, mostrada dentro de
 * PaymentPanel.tsx justo antes del botón "Cobrar" — a diferencia de
 * OrderPanel.tsx (la columna del medio, donde el cajero arma/edita el
 * pedido con +/- y ✕), acá no hay controles de edición, es puramente para
 * confirmar de un vistazo qué se va a cobrar y con qué método antes de
 * enviar la venta. Reutiliza `money`/`paymentMethodLabels` de
 * SaleReceipt.tsx para que el formato coincida con el recibo que se ve
 * justo después.
 */
export default function OrderSummary({ selectedMethod, isDidi }: OrderSummaryProps) {
  const order = usePosStore((s) => s.order);
  const total = usePosStore((s) => s.orderTotal());

  if (order.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <h3 className="text-xs font-semibold text-neutral-500 mb-2">Resumen del pedido</h3>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {order.map((line, i) => (
          <div key={i} className="flex justify-between gap-2 text-xs text-neutral-600">
            <span className="truncate">
              {line.quantity}× {line.name}
            </span>
            <span className="shrink-0 tabular-nums">{money(line.subtotal)}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-sm font-bold border-t border-neutral-100 mt-2 pt-2">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>

      <div className="flex justify-between text-xs text-neutral-500 mt-1">
        <span>Método de pago</span>
        <span className="font-medium text-neutral-700">
          {selectedMethod ? paymentMethodLabels[selectedMethod] || selectedMethod : "Sin seleccionar"}
        </span>
      </div>

      {isDidi && (
        <p className="mt-1 text-[11px] text-brand-700">Pedido DiDi — Bancolombia (Cuenta por Cobrar)</p>
      )}
    </div>
  );
}
