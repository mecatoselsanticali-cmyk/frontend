import { useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";

interface ExpenseModalProps {
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}

const categoryOptions = [
  { value: "ARRIENDO", label: "Arriendo" },
  { value: "NOMINA", label: "Nómina" },
  { value: "SERVICIOS_PUBLICOS", label: "Servicios públicos" },
  { value: "OTRO", label: "Otro" },
];

export default function ExpenseModal({ branchId, onClose, onSaved }: ExpenseModalProps) {
  const [category, setCategory] = useState("");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!category || !concept || !amount) {
      setError("Categoría, concepto y monto son obligatorios");
      return;
    }
    if (Number(amount) <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.createExpense({
        branchId,
        category,
        concept,
        amount: Number(amount),
      });
      Swal.fire({ title: "Gasto registrado", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-6 space-y-5">
          <h3 className="text-lg font-bold">Nuevo gasto</h3>

          <div>
            <label className="text-xs text-neutral-500">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            >
              <option value="">Selecciona una categoría</option>
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
              placeholder="Ej. Pago arriendo local agosto"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-500">Monto</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              placeholder="0"
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
              {saving ? "Guardando..." : "Registrar gasto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
