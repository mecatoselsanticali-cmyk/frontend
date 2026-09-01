import { useEffect, useState } from "react";
import { usePosStore } from "../../store/posStore";
import { posApi } from "../../services/posApi";
import Swal from "sweetalert2";

type LossReason = "DAMAGED" | "STAFF_CONSUMPTION" | "OTHER";

const REASON_LABELS: Record<LossReason, string> = {
  DAMAGED: "Producto dañado / vencido",
  STAFF_CONSUMPTION: "Consumo interno (empleado)",
  OTHER: "Otro",
};

interface StockProduct {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
}

export default function StockLossModal() {
  const closeModal = usePosStore((s) => s.closeModal);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<LossReason>("DAMAGED");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reutiliza GET /api/pos/stock-snapshot (ver punto 45 de CLAUDE.md) — ya
  // trae producto + stock actual de la sede, así este modal no necesita un
  // endpoint propio.
  useEffect(() => {
    posApi
      .getStockSnapshot()
      .then(setProducts)
      .catch((err: any) => setError(err.message || "No se pudo cargar el stock"))
      .finally(() => setLoadingProducts(false));
  }, []);

  const selectedProduct = products.find((p) => p.productId === productId);

  const submit = async () => {
    if (!productId || !quantity) return;
    setSaving(true);
    setError("");
    try {
      await posApi.registerStockLoss({
        productId,
        quantity: Number(quantity),
        reason,
        note: note || undefined,
      });
      Swal.fire({ title: "Merma registrada", icon: "success", timer: 1500, showConfirmButton: false });
      closeModal();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la merma");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 !m-0">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Registrar merma de stock</h3>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Cerrar"
            className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <label className="text-xs text-neutral-500">Producto</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          disabled={loadingProducts}
          className="w-full mt-1 mb-1 border border-neutral-200 rounded-lg p-2"
        >
          <option value="">{loadingProducts ? "Cargando..." : "Selecciona un producto"}</option>
          {products.map((p) => (
            <option key={p.productId} value={p.productId}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        {selectedProduct && (
          <p className="text-xs text-neutral-400 mb-3">Stock disponible: {selectedProduct.quantity}</p>
        )}

        <label className="text-xs text-neutral-500">Cantidad</label>
        <input
          type="number"
          min={1}
          max={selectedProduct?.quantity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full mt-1 mb-3 border border-neutral-200 rounded-lg p-2"
          placeholder="0"
        />

        <label className="text-xs text-neutral-500">Motivo</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as LossReason)}
          className="w-full mt-1 mb-3 border border-neutral-200 rounded-lg p-2"
        >
          {(Object.keys(REASON_LABELS) as LossReason[]).map((key) => (
            <option key={key} value={key}>
              {REASON_LABELS[key]}
            </option>
          ))}
        </select>

        <label className="text-xs text-neutral-500">Nota (opcional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full mt-1 mb-4 border border-neutral-200 rounded-lg p-2"
          placeholder="Detalle adicional"
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
            disabled={saving || !productId || !quantity}
            className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
