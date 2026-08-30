import { useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { paymentMethodLabels } from "./SaleReceipt";

interface SaleEditModalProps {
  sale: any;
  onClose: () => void;
  onSaved: () => void;
}

const orderTypeLabels: Record<string, string> = {
  POS_COUNTER: "Mostrador",
  RAPPI: "Rappi",
  DIDI: "DiDi",
  DELIVERY_LOCAL: "Domicilio propio",
};

/**
 * Edita SOLO metadata de una venta ya creada (método de pago, canal,
 * categoría, datos del cliente) — a propósito no toca items/cantidades/
 * montos, que ya movieron `ProductStock` al crearse (ver punto 19 de
 * CLAUDE.md).
 */
export default function SaleEditModal({ sale, onClose, onSaved }: SaleEditModalProps) {
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod);
  const [orderType, setOrderType] = useState(sale.orderType);
  const [category, setCategory] = useState<"REGULAR" | "SPECIAL">(sale.category || "REGULAR");
  const [customerName, setCustomerName] = useState(sale.customer?.name || "");
  const [customerDocument, setCustomerDocument] = useState(sale.customer?.document || "");
  const [customerEmail, setCustomerEmail] = useState(sale.customer?.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const customer =
        customerName || customerDocument || customerEmail
          ? { name: customerName || undefined, document: customerDocument || undefined, email: customerEmail || undefined }
          : undefined;

      await adminApi.updateSale(sale._id, { paymentMethod, orderType, customer, category });
      Swal.fire({ title: "Venta actualizada", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la venta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Editar venta</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-neutral-400">
            Solo se pueden editar método de pago, canal y datos del cliente — los
            productos y montos de una venta ya registrada no se pueden modificar.
          </p>

          <div>
            <label className="text-xs text-neutral-500">Método de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            >
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-500">Canal</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            >
              {Object.entries(orderTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-500">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "REGULAR" | "SPECIAL")}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            >
              <option value="REGULAR">Regular</option>
              <option value="SPECIAL">Especial</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-500">Datos del cliente (opcional)</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre"
                className="border border-neutral-200 rounded-lg p-2 text-sm"
              />
              <input
                value={customerDocument}
                onChange={(e) => setCustomerDocument(e.target.value)}
                placeholder="Documento"
                className="border border-neutral-200 rounded-lg p-2 text-sm"
              />
              <input
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Correo"
                className="border border-neutral-200 rounded-lg p-2 text-sm col-span-2"
              />
            </div>
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
