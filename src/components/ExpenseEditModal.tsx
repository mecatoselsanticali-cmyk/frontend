import { useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";

interface ExpenseEditModalProps {
  expense: any;
  onClose: () => void;
  onSaved: () => void;
}

// A diferencia de `ExpenseModal.tsx` (creación, solo admin), acá SÍ se
// incluye "Caja menor" — un gasto existente puede ya tener esa categoría
// (viene del arqueo del cajero, ver CashClosure) y omitirla del <select>
// dejaría esa opción huérfana o forzaría un cambio de categoría no pedido
// con solo abrir el modal.
const categoryOptions = [
  { value: "PETTY_CASH", label: "Caja menor" },
  { value: "ARRIENDO", label: "Arriendo" },
  { value: "NOMINA", label: "Nómina" },
  { value: "SERVICIOS_PUBLICOS", label: "Servicios públicos" },
  { value: "OTRO", label: "Otro" },
];

/**
 * Edita categoría/concepto/monto de un gasto ya registrado. A diferencia de
 * PurchaseEditModal, Expense no tiene `productId`/stock que ajustar — es un
 * patch simple, sin efectos secundarios sobre inventario.
 */
export default function ExpenseEditModal({ expense, onClose, onSaved }: ExpenseEditModalProps) {
  const [category, setCategory] = useState(expense.category || "");
  const [concept, setConcept] = useState(expense.concept || "");
  const [amount, setAmount] = useState(String(expense.amount ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!category || !concept) {
      setError("Categoría y concepto son obligatorios");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.updateExpense(expense._id, {
        category,
        concept,
        amount: Number(amount),
      });
      Swal.fire({ title: "Gasto actualizado", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Editar gasto</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-xs text-neutral-500">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            >
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-500">Concepto</label>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-500">Monto</label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
