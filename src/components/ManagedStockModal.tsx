import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";

interface BranchStock {
  branchId: string;
  branchName: string;
  quantity: number;
}

export interface StagedAllocation {
  branchId: string;
  branchName: string;
  quantity: number;
}

interface ManagedStockModalProps {
  // Modo "gestionar" (`product._id` existe): producto real, ya guardado —
  // lee/escribe stock contra el backend de una. Modo "staging" (`product`
  // sin `_id`, ej. `{ name: form.name }`): todavía no existe el producto
  // (se está llenando `ProductModal.tsx` para uno nuevo), así que no hay
  // nada que consultar ni nada que guardar — solo arma la lista de sedes en
  // 0 y devuelve las cantidades elegidas por `onStage`, sin tocar el
  // backend. `ProductModal.tsx` guarda esas asignaciones en su propio
  // estado y las manda junto con la creación del producto (ver el
  // comentario en `submit()` de ese archivo).
  product: any;
  onClose: () => void;
  /** Modo "gestionar" — refresca la tabla del caller tras guardar en el backend. */
  onSaved?: () => void;
  /** Modo "staging" — recibe las asignaciones elegidas, nunca llama al backend. */
  onStage?: (allocations: StagedAllocation[]) => void;
  /** Modo "staging" únicamente — para reabrir el modal con lo que ya se
   * había elegido antes (botón "Editar" del resumen en ProductModal.tsx),
   * en vez de reiniciar todo en 0. */
  initialAllocations?: StagedAllocation[];
}

/**
 * Gestión DIRECTA de stock por sede — a diferencia de `StockModal.tsx` en
 * modo top-up (que SUMA una cantidad repartida entre sedes, `$inc` del
 * lado del backend), este modal fija el valor exacto de cada sede
 * (`$set`, `PUT /products/:id/stock`, ver punto 60 de admin-frontend/
 * CLAUDE.md). Pensado para dos casos que las compras no cubren: el
 * negocio ya tenía stock físico antes de usar el sistema, o el conteo se
 * desincronizó y hace falta corregirlo sin simular una compra/venta que
 * nunca pasó. Solo ADMIN — ver el botón que abre esto en `Inventario.tsx`
 * y `requireRole("ADMIN")` en el backend (nunca MANAGER, a diferencia del
 * top-up de `StockModal.tsx`).
 *
 * **Dos modos, mismo componente** (ver `isStaging` abajo): "gestionar" un
 * producto que ya existe (llama al backend de una), o "staging" para
 * armar el stock inicial de un producto que `ProductModal.tsx` todavía
 * está creando (no hay `product._id` real todavía) — en ese caso este
 * modal solo junta la elección del admin y se la devuelve a
 * `ProductModal.tsx` por `onStage`, que la manda al backend recién cuando
 * el producto ya se creó y tiene un id real. Ver el comentario del punto
 * 60 en `ProductModal.tsx` para el flujo completo.
 */
export default function ManagedStockModal({
  product,
  onClose,
  onSaved,
  onStage,
  initialAllocations,
}: ManagedStockModalProps) {
  const isStaging = !product?._id;

  const [branchStocks, setBranchStocks] = useState<BranchStock[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isStaging) {
      // Sin producto real todavía — no hay nada que pedirle a
      // `getProductStock` (ese endpoint necesita un `productId` real).
      // Solo hace falta la lista de sedes activas, todas en 0 salvo que
      // ya se haya elegido algo antes (`initialAllocations`, al reabrir
      // desde "Editar" en ProductModal.tsx).
      adminApi
        .listBranches({ pageSize: 100 })
        .then((res) => {
          const stocks: BranchStock[] = res.data.map((b: any) => ({
            branchId: b._id,
            branchName: b.name,
            quantity: 0,
          }));
          setBranchStocks(stocks);
          setQuantities(
            Object.fromEntries(
              stocks.map((b) => {
                const staged = initialAllocations?.find((a) => a.branchId === b.branchId);
                return [b.branchId, String(staged?.quantity ?? 0)];
              })
            )
          );
        })
        .catch((err: any) => setError(err.message || "No se pudieron cargar las sedes"))
        .finally(() => setLoading(false));
      return;
    }

    adminApi
      .getProductStock(product._id)
      .then((data) => {
        setBranchStocks(data.branchStocks);
        setQuantities(
          Object.fromEntries(data.branchStocks.map((b: BranchStock) => [b.branchId, String(b.quantity)]))
        );
      })
      .catch((err: any) => setError(err.message || "No se pudo cargar el stock"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaging, product._id]);

  const currentTotal = branchStocks.reduce((sum, b) => sum + b.quantity, 0);
  const newTotal = branchStocks.reduce((sum, b) => sum + (Number(quantities[b.branchId]) || 0), 0);

  const updateQuantity = (branchId: string, value: string) => {
    // Solo dígitos — el input es de texto (pedido explícito) pero el valor
    // sigue siendo una cantidad entera no negativa, mismo criterio que el
    // resto de inputs de cantidad del proyecto (ver PIN de cajero, punto
    // 30 en admin-frontend/src/cajero/CLAUDE.md).
    setQuantities({ ...quantities, [branchId]: value.replace(/\D/g, "") });
  };

  const submit = async () => {
    const allocations = branchStocks.map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      quantity: Number(quantities[b.branchId]) || 0,
    }));

    if (isStaging) {
      onStage?.(allocations);
      onClose();
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.setProductStock(product._id, allocations);
      Swal.fire({ title: "Stock actualizado", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar el stock");
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
              <h3 className="text-lg font-bold">
                {isStaging ? "Inventario inicial" : `Gestionar stock — ${product.name}`}
              </h3>
              {!loading && !isStaging && (
                <p className="text-xs text-neutral-400">
                  Stock actual total: {currentTotal.toLocaleString("es-CO")} unidades
                </p>
              )}
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

          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            {isStaging
              ? "Asigna cuánto stock inicial tiene este producto en cada sede — se guarda junto con el producto al presionar \"Crear producto\"."
              : 'Esto reemplaza directamente la cantidad registrada en cada sede — úsalo para corregir el conteo, no para registrar una compra o venta.'}
          </p>

          {loading ? (
            <p className="text-sm text-neutral-400">Cargando sedes...</p>
          ) : (
            <div className="space-y-2">
              {branchStocks.map((b) => (
                <div key={b.branchId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{b.branchName}</p>
                    {!isStaging && (
                      <p className="text-xs text-neutral-400">Actual: {b.quantity.toLocaleString("es-CO")}</p>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantities[b.branchId] ?? ""}
                    onChange={(e) => updateQuantity(b.branchId, e.target.value)}
                    className="w-28 border border-neutral-200 rounded-lg p-2 text-sm text-right"
                    placeholder="0"
                  />
                </div>
              ))}
              {branchStocks.length === 0 && (
                <p className="text-xs text-neutral-400">No hay sedes activas registradas</p>
              )}
              {branchStocks.length > 0 && (
                <div className="flex justify-between pt-2 border-t border-neutral-100 text-sm font-semibold">
                  <span>{isStaging ? "Total" : "Nuevo total"}</span>
                  <span>{newTotal.toLocaleString("es-CO")} unidades</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving || loading || branchStocks.length === 0}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : isStaging ? "Guardar" : "Guardar stock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
