import { useMemo, useState } from "react";
import { usePosStore } from "../../store/posStore";

/**
 * Selector visual de billetes y monedas colombianos: el cajero toca cada
 * denominación que el cliente entregó (varias veces si entregó varios) en
 * vez de contar y digitar el efectivo a mano. Al confirmar, dispara un
 * evento que PaymentPanel escucha para completar el pago — mismo patrón que
 * CustomerModal usa para "mecatos:customer-captured".
 */

interface Denomination {
  value: number;
  type: "bill" | "coin";
  color: string;
  textColor?: string;
  ring?: string;
}

const BILLS: Denomination[] = [
  { value: 100000, type: "bill", color: "bg-fuchsia-700" },
  { value: 50000, type: "bill", color: "bg-emerald-600" },
  { value: 20000, type: "bill", color: "bg-orange-500" },
  { value: 10000, type: "bill", color: "bg-red-600" },
  { value: 5000, type: "bill", color: "bg-violet-600" },
  { value: 2000, type: "bill", color: "bg-lime-700" },
];

const COINS: Denomination[] = [
  { value: 1000, type: "coin", color: "bg-amber-600" },
  { value: 500, type: "coin", color: "bg-neutral-300", textColor: "text-neutral-700", ring: "bg-yellow-500" },
  { value: 200, type: "coin", color: "bg-yellow-500", textColor: "text-neutral-800" },
  { value: 100, type: "coin", color: "bg-neutral-300", textColor: "text-neutral-700" },
];

function formatCOP(value: number) {
  return `$${value.toLocaleString("es-CO")}`;
}

export default function CashPaymentModal() {
  const closeModal = usePosStore((s) => s.closeModal);
  const total = usePosStore((s) => s.orderTotal());

  const [counts, setCounts] = useState<Record<number, number>>({});

  const received = useMemo(
    () => Object.entries(counts).reduce((acc, [value, count]) => acc + Number(value) * count, 0),
    [counts]
  );
  const change = received - total;

  const add = (value: number) => setCounts((c) => ({ ...c, [value]: (c[value] || 0) + 1 }));
  const remove = (value: number) =>
    setCounts((c) => ({ ...c, [value]: Math.max(0, (c[value] || 0) - 1) }));
  const reset = () => setCounts({});

  const confirm = () => {
    if (received <= 0) return;
    window.dispatchEvent(new CustomEvent("mecatos:cash-received", { detail: { amount: received } }));
    closeModal();
  };

  const renderDenomination = (d: Denomination) => {
    const count = counts[d.value] || 0;
    return (
      <button
        key={d.value}
        type="button"
        onClick={() => add(d.value)}
        className="relative flex flex-col items-center gap-1"
      >
        {d.type === "bill" ? (
          <div
            className={`w-24 h-14 rounded-md ${d.color} text-white shadow flex items-center justify-center font-bold text-xs px-1 text-center border border-black/10`}
          >
            {formatCOP(d.value)}
          </div>
        ) : (
          <div
            className={`relative w-16 h-16 rounded-full ${d.color} ${d.textColor || "text-white"} shadow flex items-center justify-center font-bold text-xs border border-black/10`}
          >
            {d.ring && <div className={`absolute inset-[6px] rounded-full ${d.ring}`} />}
            <span className="relative">{formatCOP(d.value)}</span>
          </div>
        )}
        {count > 0 && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              remove(d.value);
            }}
            role="button"
            aria-label={`Quitar uno de ${formatCOP(d.value)}`}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white"
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">Efectivo recibido</h3>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Cerrar"
            className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-neutral-500 mb-4">
          Toca cada billete o moneda que entregó el cliente. Toca el número para quitar uno.
        </p>

        <div className="mb-3">
          <p className="text-xs font-semibold text-neutral-500 mb-2">Billetes</p>
          <div className="grid grid-cols-3 gap-3">{BILLS.map(renderDenomination)}</div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-neutral-500 mb-2">Monedas</p>
          <div className="grid grid-cols-4 gap-3">{COINS.map(renderDenomination)}</div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-3 space-y-1 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Total a cobrar</span>
            <span className="font-medium">{formatCOP(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">Efectivo recibido</span>
            <span className="font-medium">{formatCOP(received)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-500">{change < 0 ? "Falta" : "Vueltas"}</span>
            <span className={`font-bold ${change < 0 ? "text-red-500" : "text-green-600"}`}>
              {formatCOP(Math.abs(change))}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="text-xs text-neutral-400 hover:text-neutral-600 px-2"
          >
            Reiniciar
          </button>
          <button
            onClick={closeModal}
            className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={received <= 0}
            className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
