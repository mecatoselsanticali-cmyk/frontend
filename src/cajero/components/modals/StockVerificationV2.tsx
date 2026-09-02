import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { posApi } from "../../services/posApi";

interface StockSnapshotItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
}

type RowStatus = "PENDING" | "CONFIRMED" | "CORRECTED";

export interface StockVerificationV2Summary {
  /** true solo cuando CADA fila quedó en un estado terminal (confirmada o corregida) — ninguna sigue pendiente. */
  allResolved: boolean;
  /** Solo las filas que se corrigieron (no las que solo se confirmaron) — usado para armar la anotación automática que se manda a `openShift`/`closeShift` cuando este diseño está activo (ver punto 47 de CLAUDE.md). */
  corrections: { sku: string; name: string; quantity: number }[];
}

/**
 * Verificación de stock al abrir/cerrar turno — única implementación
 * desde que se decidió reemplazar el diseño original (ver punto 47 de
 * CLAUDE.md: existió un toggle temporal entre este componente y
 * `StockVerification`, la función que vivía dentro de `ShiftModal.tsx`
 * con un solo toggle "¿coincide?" para TODA la tabla + anotación de texto
 * libre — ese componente y el toggle se eliminaron, este ganó).
 *
 * Cada fila se confirma o corrige por separado con ✓/✗ — ✓ solo marca
 * visualmente que esa fila coincide (no hay nada que cambiar en el
 * servidor); ✗ abre un input numérico junto a los íconos para que el
 * cajero escriba la cantidad real contada, y esa cantidad se aplica de
 * inmediato contra `ProductStock` en el backend (`POST
 * /api/pos/stock-snapshot/adjust`, ver `adjustStockCount` en
 * `cashClosureController.ts`) — no es una anotación descriptiva, es una
 * corrección real del inventario.
 *
 * Solo muestra SKU/Producto/Cantidad — sin precio unitario ni valor
 * total.
 *
 * `onSummaryChange` es cómo este componente le informa a `ShiftModal.tsx`
 * si ya se puede habilitar "Abrir"/"Cerrar" (todas las filas resueltas) y
 * qué corrección mandar como `stockAnnotation` (ver punto 47 de CLAUDE.md
 * para el detalle de cómo se traduce a `stockConfirmed`/`stockAnnotation`,
 * el shape que `openShift`/`closeShift` ya esperaban en el backend, sin
 * haber tenido que cambiar esos dos endpoints).
 */
export default function StockVerificationV2({
  onSummaryChange,
}: {
  onSummaryChange?: (summary: StockVerificationV2Summary) => void;
}) {
  const [items, setItems] = useState<StockSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusByProduct, setStatusByProduct] = useState<Record<string, RowStatus>>({});
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [draftQuantity, setDraftQuantity] = useState<Record<string, string>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);

  useEffect(() => {
    posApi
      .getStockSnapshot()
      .then(setItems)
      .catch((err: any) => setError(err.message || "No se pudo cargar el stock"))
      .finally(() => setLoading(false));
  }, []);

  // Informa al padre (`ShiftModal.tsx`) si ya se puede habilitar el envío
  // y qué corrección anotar — `onSummaryChange` a propósito NO va en las
  // dependencias: el padre lo redefine en cada render (es un setter de
  // `useState` envuelto inline), así que incluirlo dispararía el efecto en
  // cada re-render del padre, no solo cuando `items`/`statusByProduct`
  // cambian de verdad. Sigue usando la versión más reciente vía closure
  // sin necesitar estar en el arreglo de dependencias.
  useEffect(() => {
    if (!onSummaryChange) return;
    const allResolved =
      items.length > 0 &&
      items.every((it) => (statusByProduct[it.productId] || "PENDING") !== "PENDING");
    const corrections = items
      .filter((it) => statusByProduct[it.productId] === "CORRECTED")
      .map((it) => ({ sku: it.sku, name: it.name, quantity: it.quantity }));
    onSummaryChange({ allResolved, corrections });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, statusByProduct]);

  const confirmRow = (productId: string) => {
    setEditingProduct((prev) => (prev === productId ? null : prev));
    setStatusByProduct((prev) => ({ ...prev, [productId]: "CONFIRMED" }));
  };

  const startEditing = (item: StockSnapshotItem) => {
    setDraftQuantity((prev) => ({ ...prev, [item.productId]: String(item.quantity) }));
    setEditingProduct(item.productId);
  };

  const submitCorrection = async (item: StockSnapshotItem) => {
    const value = draftQuantity[item.productId];
    if (value === undefined || value === "") return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setSavingProduct(item.productId);
    setError("");
    try {
      await posApi.adjustStockCount(item.productId, parsed);
      setItems((prev) =>
        prev.map((it) => (it.productId === item.productId ? { ...it, quantity: parsed } : it))
      );
      setStatusByProduct((prev) => ({ ...prev, [item.productId]: "CORRECTED" }));
      setEditingProduct(null);
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el stock");
    } finally {
      setSavingProduct(null);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-700">Verificación de inventario</h4>

      {loading && <p className="text-xs text-neutral-400">Cargando inventario...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          {/* Altura FIJA (no `max-h-*`) — a propósito, para que el modal no
              cambie de tamaño según cuántos productos tenga la sede; con
              pocos productos queda espacio vacío abajo, con muchos aparece
              el scroll interno, pero el modal alrededor siempre mide igual. */}
          <div className="h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 sticky top-0">
                <tr className="text-left text-neutral-500">
                  <th className="p-2 font-medium">SKU</th>
                  <th className="p-2 font-medium">Producto</th>
                  <th className="p-2 font-medium text-right">Cant.</th>
                  <th className="p-2 font-medium text-center">¿Coincide?</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const status = statusByProduct[it.productId] || "PENDING";
                  const editing = editingProduct === it.productId;
                  return (
                    <tr key={it.productId} className="border-t border-neutral-100">
                      <td className="p-2 text-neutral-500">{it.sku}</td>
                      <td className="p-2">{it.name}</td>
                      <td className="p-2 text-right">{it.quantity}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            type="button"
                            onClick={() => confirmRow(it.productId)}
                            title="Coincide"
                            className={`rounded-full p-1 transition-colors ${
                              status === "CONFIRMED"
                                ? "bg-green-100 text-green-600"
                                : "text-neutral-400 hover:bg-green-50 hover:text-green-600"
                            }`}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(it)}
                            title="No coincide — corregir cantidad"
                            className={`rounded-full p-1 transition-colors ${
                              status === "CORRECTED" || editing
                                ? "bg-red-100 text-red-600"
                                : "text-neutral-400 hover:bg-red-50 hover:text-red-600"
                            }`}
                          >
                            <X size={16} />
                          </button>
                          {editing && (
                            <>
                              <input
                                type="number"
                                min={0}
                                autoFocus
                                value={draftQuantity[it.productId] ?? ""}
                                onChange={(e) =>
                                  setDraftQuantity((prev) => ({
                                    ...prev,
                                    [it.productId]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") submitCorrection(it);
                                }}
                                className="w-14 border border-neutral-200 rounded p-1 text-xs"
                                placeholder="Cant."
                              />
                              <button
                                type="button"
                                onClick={() => submitCorrection(it)}
                                disabled={savingProduct === it.productId}
                                title="Guardar cantidad contada"
                                className="text-brand-600 hover:text-brand-700 disabled:opacity-50"
                              >
                                <Check size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-neutral-400">
                      No hay stock registrado en esta sede
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
