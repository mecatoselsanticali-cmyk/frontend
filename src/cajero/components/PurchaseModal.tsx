import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { usePosStore } from "../store/posStore";
import { posApi } from "../services/posApi";
import { Plus, Trash2 } from "lucide-react";

interface PurchaseItem {
  productId: string;
  amount: string;
  quantity: string;
}

const emptyPurchaseItem = (): PurchaseItem => ({ productId: "", amount: "", quantity: "" });

interface PurchaseModalProps {
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Copia intencional (no un import — ver punto 12 de CLAUDE.md) del modo
 * "compra" de admin-frontend/src/components/StockModal.tsx, restringida al
 * cajero: sin selector de sede (siempre la de la sesión actual, tomada de
 * usePosStore — un cajero solo puede comprar para su propia sede) y sin la
 * opción "+ Crear nuevo producto" (el cajero no tiene permiso para crear
 * productos, solo elegir entre el catálogo existente). Reemplaza el viejo
 * formulario informal (proveedor/concepto/monto + foto de recibo, sin
 * vínculo a inventario) — esta compra SÍ agrega stock en la sede del
 * cajero, igual que el flujo del admin.
 */
export default function PurchaseModal({ onClose, onSaved }: PurchaseModalProps) {
  const branchName = usePosStore((s) => s.branchName);

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [supplierName, setSupplierName] = useState("");
  const [concept, setConcept] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([emptyPurchaseItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    posApi
      .getProductsForPurchase()
      .then(setProducts)
      .catch((err: any) => setError(err.message || "No se pudo cargar el catálogo"))
      .finally(() => setLoadingProducts(false));
  }, []);

  const addItem = () => setItems((prev) => [...prev, emptyPurchaseItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<PurchaseItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const validItems = items.filter(
    (it) => it.productId && Number(it.quantity) > 0 && Number(it.amount) > 0
  );
  const canSubmit = Boolean(supplierName) && validItems.length > 0;

  const submit = async () => {
    if (!supplierName) {
      setError("El proveedor es requerido");
      return;
    }
    if (validItems.length === 0) {
      setError("Agrega al menos un producto con cantidad y monto");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await Promise.all(
        validItems.map((it) =>
          posApi.createPurchase({
            productId: it.productId,
            supplierName,
            concept: concept || undefined,
            amount: Number(it.amount),
            quantity: Number(it.quantity),
          })
        )
      );
      Swal.fire({ title: "Compra registrada", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">Nueva compra</h3>
              <p className="text-xs text-neutral-400">{branchName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-neutral-500">Proveedor</label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="Ej. Distribuidora XYZ"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-500">Concepto (opcional)</label>
              <input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="Ej. Compra de insumos de la semana"
              />
            </div>

            {loadingProducts ? (
              <p className="text-sm text-neutral-400">Cargando catálogo...</p>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-neutral-500">Productos</label>
                {items.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(index, { productId: e.target.value })}
                        className="w-full border border-neutral-200 rounded-lg p-2 text-sm"
                      >
                        <option value="">Selecciona un producto</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={item.amount}
                      onChange={(e) => updateItem(index, { amount: e.target.value })}
                      placeholder="Monto pagado"
                      className="w-28 border border-neutral-200 rounded-lg p-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: e.target.value })}
                      placeholder="Cantidad"
                      className="w-24 border border-neutral-200 rounded-lg p-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="text-neutral-400 hover:text-red-500 disabled:opacity-30 p-2"
                      aria-label="Quitar producto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                >
                  <Plus size={14} />
                  Agregar producto
                </button>
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
              disabled={saving || !canSubmit}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Registrar compra"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
