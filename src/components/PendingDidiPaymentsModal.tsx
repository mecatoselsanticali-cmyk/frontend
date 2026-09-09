import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { formatDateTime } from "../utils/timezone";

interface PendingSale {
  _id: string;
  createdAt: string;
  total: number;
  cashierId?: { name: string };
  branchId?: { name: string };
}

/**
 * Lista + confirmación en bloque de ventas DiDi/Rappi pendientes de pago —
 * reemplaza el diseño anterior (checkboxes sueltos directo en la tabla de
 * `Ventas.tsx`, pedido explícito de sacarlos porque se veían recargados
 * ahí) con un modal dedicado. `Ventas.tsx` lo abre desde el botón
 * "Pendientes DiDi/Rappi" y también automáticamente los miércoles si hay
 * algo pendiente — ver el efecto correspondiente ahí, este componente no
 * sabe nada de qué día es, solo de mostrar/confirmar la lista. Reemplaza
 * a `BulkConfirmPaymentModal.tsx` (eliminado, ya no lo usa nadie) — este
 * componente carga la lista por su cuenta en vez de recibir los ids ya
 * elegidos desde afuera, así que no hacía falta mantener los dos.
 */
export default function PendingDidiPaymentsModal({
  branchId,
  onClose,
  onConfirmed,
}: {
  branchId?: string;
  onClose: () => void;
  /** Avisa al padre que algo se confirmó, para que refresque su propia
   * tabla y el conteo del banner — este modal sigue abierto y se
   * refresca a sí mismo por separado (`load()` de acá abajo). */
  onConfirmed: () => void;
}) {
  const [sales, setSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    adminApi
      .listSales({
        branchId,
        paymentMethod: "DELIVERY_APP",
        paymentStatus: "PENDING_PAYMENT",
        page: 1,
        pageSize: 100,
      })
      .then((res) => {
        setSales(res.data);
        setSelectedIds(new Set());
      })
      .catch((err: any) => setError(err.message || "No se pudieron cargar las ventas pendientes"))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [branchId]);

  const allChecked = sales.length > 0 && sales.every((s) => selectedIds.has(s._id));
  const selectedTotal = sales
    .filter((s) => selectedIds.has(s._id))
    .reduce((acc, s) => acc + s.total, 0);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allChecked ? new Set() : new Set(sales.map((s) => s._id)));
  };

  const submit = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await adminApi.confirmSalePaymentBulk({
        saleIds: Array.from(selectedIds),
        settlementReference: reference.trim() || undefined,
      });
      setReference("");
      onConfirmed();
      load();
      if (res.skipped.length === 0) {
        Swal.fire({
          title: `${res.confirmed.length} venta${res.confirmed.length === 1 ? "" : "s"} confirmada${
            res.confirmed.length === 1 ? "" : "s"
          }`,
          icon: "success",
          timer: 1800,
          showConfirmButton: false,
        });
      } else {
        // Algunas quedaron fuera (ej. otro admin ya las confirmó justo
        // antes) — se informa cuántas sí y cuántas no, en vez de un
        // mensaje binario de éxito/error.
        Swal.fire({
          title: `${res.confirmed.length} confirmada${res.confirmed.length === 1 ? "" : "s"}, ${
            res.skipped.length
          } no se pudo${res.skipped.length === 1 ? "" : "ieron"} confirmar`,
          text: res.skipped.map((s: { reason: string }) => s.reason).join("; "),
          icon: "warning",
        });
      }
    } catch (err: any) {
      setError(err.message || "No se pudieron confirmar las ventas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Ventas DiDi/Rappi pendientes de pago</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {loading && <p className="text-sm text-neutral-400">Cargando...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {!loading && !error && sales.length === 0 && (
            <p className="text-sm text-neutral-400 py-6 text-center">
              No hay ventas DiDi/Rappi pendientes de pago 🎉
            </p>
          )}

          {!loading && sales.length > 0 && (
            <>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-neutral-500 text-left sticky top-0">
                      <tr>
                        <th className="p-2 w-8">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={toggleSelectAll}
                            aria-label="Seleccionar todas"
                          />
                        </th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Sede</th>
                        <th className="p-2">Cajero</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s._id} className="border-t border-neutral-100">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(s._id)}
                              onChange={() => toggleSelected(s._id)}
                              aria-label={`Seleccionar venta ${s._id}`}
                            />
                          </td>
                          <td className="p-2 text-neutral-500">{formatDateTime(s.createdAt)}</td>
                          <td className="p-2">{s.branchId?.name || "—"}</td>
                          <td className="p-2">{s.cashierId?.name || "—"}</td>
                          <td className="p-2 text-right font-medium">${s.total.toLocaleString("es-CO")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-neutral-50 rounded-lg p-3 flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {selectedIds.size} de {sales.length} seleccionada{selectedIds.size === 1 ? "" : "s"}
                </span>
                <span className="font-bold text-neutral-800">${selectedTotal.toLocaleString("es-CO")}</span>
              </div>

              <div>
                <label className="text-xs text-neutral-500">
                  Número de comprobante / transferencia (opcional)
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full mt-1 border border-neutral-200 rounded-lg p-2 text-base"
                  placeholder="Ej. TRX-00123456"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium">
                  Cerrar
                </button>
                <button
                  onClick={submit}
                  disabled={saving || selectedIds.size === 0}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving
                    ? "Confirmando..."
                    : `Confirmar ${selectedIds.size || ""} venta${selectedIds.size === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
