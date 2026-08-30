import { useState } from "react";
import { usePosStore } from "../store/posStore";

export default function OrderPanel() {
  const order = usePosStore((s) => s.order);
  const removeLine = usePosStore((s) => s.removeLine);
  const updateLineQuantity = usePosStore((s) => s.updateLineQuantity);
  const orderTotal = usePosStore((s) => s.orderTotal());

  // Edición directa de cantidad tocando el número (además de los botones
  // +/-) — un solo índice a la vez, igual que solo puede haber un modal
  // activo a la vez en esta pantalla. `updateLineQuantity` (posStore.ts) ya
  // ignora cualquier valor < 1 dejando la línea intacta, así que no hace
  // falta duplicar esa validación acá — solo se filtra que sea un número
  // válido antes de llamarla.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const startEditing = (index: number, quantity: number) => {
    setEditingIndex(index);
    setEditingValue(String(quantity));
  };

  const commitEditing = () => {
    if (editingIndex !== null) {
      const parsed = parseInt(editingValue, 10);
      if (Number.isFinite(parsed) && parsed >= 1) {
        updateLineQuantity(editingIndex, parsed);
      }
    }
    setEditingIndex(null);
    setEditingValue("");
  };

  return (
    <div className="w-[32%] h-full flex flex-col bg-white border-r border-neutral-200">
      <div className="p-4 border-b border-neutral-200">
        <h2 className="text-lg font-bold">Orden Actual</h2>
        <p className="text-neutral-400 text-sm">{order.length} ítem(s)</p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
        {order.length === 0 && (
          <div className="p-8 text-center text-neutral-400">
            Toca un producto para agregarlo a la orden
          </div>
        )}

        {order.map((line, index) => (
          <div key={index} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium text-sm">{line.name}</div>
              {line.modifiers.length > 0 && (
                <div className="text-xs text-neutral-400">
                  {line.modifiers.map((m) => m.name).join(", ")}
                </div>
              )}
              <div className="text-brand-700 font-semibold text-sm">
                ${line.subtotal.toLocaleString("es-CO")}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateLineQuantity(index, line.quantity - 1)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center"
              >
                −
              </button>
              {editingIndex === index ? (
                <input
                  type="number"
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={commitEditing}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setEditingIndex(null);
                      setEditingValue("");
                    }
                  }}
                  className="w-12 text-center text-sm border border-neutral-300 rounded"
                />
              ) : (
                <span
                  onClick={() => startEditing(index, line.quantity)}
                  className="w-5 text-center text-sm cursor-pointer"
                >
                  {line.quantity}
                </span>
              )}
              <button
                onClick={() => updateLineQuantity(index, line.quantity + 1)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center"
              >
                +
              </button>
            </div>

            <button
              onClick={() => removeLine(index)}
              className="text-red-400 hover:text-red-600 text-sm px-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      
      <div className="p-4 border-t border-neutral-200 bg-neutral-50">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${orderTotal.toLocaleString("es-CO")}</span>
        </div>
      </div>
    </div>
  );
}
