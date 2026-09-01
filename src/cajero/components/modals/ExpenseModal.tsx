import { useState } from "react";
import Swal from "sweetalert2";
import { usePosStore } from "../../store/posStore";
import { posApi } from "../../services/posApi";

export default function ExpenseModal() {
  const closeModal = usePosStore((s) => s.closeModal);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!concept || !amount) return;
    setSaving(true);
    setError("");
    try {
      await posApi.registerExpense(concept, Number(amount));
      Swal.fire({ title: "Gasto registrado", icon: "success", timer: 1500, showConfirmButton: false });
      closeModal();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar el gasto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 !m-0">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Gasto caja menor</h3>
          <button
              type="button"
              onClick={closeModal}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
        </div>
        

        <label className="text-xs text-neutral-500">Concepto</label>
        <input
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          className="w-full mt-1 mb-3 border border-neutral-200 rounded-lg p-2"
          placeholder="Ej. Compra de bolsas"
        />

        <label className="text-xs text-neutral-500">Monto</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full mt-1 mb-4 border border-neutral-200 rounded-lg p-2"
          placeholder="0"
        />

        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={closeModal}
            className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
