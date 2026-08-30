import { useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";

interface PurchaseEditModalProps {
  purchase: any;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edita proveedor/concepto/monto libremente (no afectan stock). La cantidad
 * solo se edita si la compra tiene `productId` (reabastecimiento registrado
 * desde el admin, ver punto 16 de CLAUDE.md) — el backend valida que, si se
 * reduce, ese stock siga disponible en la sede antes de "quitarlo" (rechaza
 * con 422 si parte ya se vendió o se usó).
 */
export default function PurchaseEditModal({ purchase, onClose, onSaved }: PurchaseEditModalProps) {
  const hasStock = Boolean(purchase.productId);

  const [supplierName, setSupplierName] = useState(purchase.supplierName || "");
  const [concept, setConcept] = useState(purchase.concept || "");
  const [amount, setAmount] = useState(String(purchase.amount ?? ""));
  const [quantity, setQuantity] = useState(String(purchase.quantity ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!supplierName) {
      setError("El proveedor es requerido");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    if (hasStock && (!quantity || Number(quantity) <= 0)) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.updatePurchase(purchase._id, {
        supplierName,
        concept: concept || undefined,
        amount: Number(amount),
        ...(hasStock ? { quantity: Number(quantity) } : {}),
      });
      Swal.fire({ title: "Compra actualizada", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Editar compra</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {hasStock && (
            <p className="text-xs text-neutral-400">
              Producto: <span className="font-medium text-neutral-600">{purchase.productId.name}</span> · Sede:{" "}
              <span className="font-medium text-neutral-600">{purchase.branchId?.name || "—"}</span>. Si reduces
              la cantidad y ese stock ya fue vendido o usado, no se podrá guardar.
            </p>
          )}

          <div>
            <label className="text-xs text-neutral-500">Proveedor</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-500">Concepto</label>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>

          <div className={hasStock ? "grid grid-cols-2 gap-2" : ""}>
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
            {hasStock && (
              <div>
                <label className="text-xs text-neutral-500">Cantidad</label>
                <input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                />
              </div>
            )}
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
