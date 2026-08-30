import { useState } from "react";
import { adminApi } from "../services/api";

interface BranchModalProps {
  branch?: any; // si viene, el modal edita en vez de crear
  onClose: () => void;
  // Recibe la sede creada/editada — StockModal.tsx lo usa para agregar la
  // sede recién creada a su propio catálogo en memoria y seleccionarla,
  // igual que ProductModal.tsx.
  onSaved: (branch?: any) => void;
}

const emptyForm = { name: "", address: "", phone: "", dailyCap: "", dianResponsible: false };

export default function BranchModal({ branch, onClose, onSaved }: BranchModalProps) {
  const isEditing = Boolean(branch);

  const [form, setForm] = useState(
    branch
      ? {
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          dianResponsible: branch.dianResponsible ?? false,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name || !form.address || !form.phone) {
      setError("Nombre, dirección y teléfono son requeridos");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      address: form.address,
      phone: form.phone,
      dianResponsible: form.dianResponsible,
    };

    try {
      const saved = isEditing
        ? await adminApi.updateBranch(branch._id, payload)
        : await adminApi.createBranch({ ...payload, status: true });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la sede");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{isEditing ? "Editar sede" : "Nueva sede"}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="Ej. Mecatos el Santi — Sede Norte"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Dirección</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dianResponsible}
                onChange={(e) => setForm({ ...form, dianResponsible: e.target.checked })}
                className="rounded border-neutral-300"
              />
              Responsable de declarar ante la DIAN
            </label>
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
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear sede"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
