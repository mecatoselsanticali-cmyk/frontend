import { useEffect, useState } from "react";
import { adminApi } from "../services/api";
import { formatDateTime } from "../utils/timezone";

const money = (n?: number) => (n === undefined || n === null ? "—" : `$${n.toLocaleString("es-CO")}`);

interface StockSnapshotItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  totalValue: number;
}

interface StockVerification {
  confirmed: boolean;
  annotation?: string;
  snapshot: StockSnapshotItem[];
  verifiedAt: string;
}

interface ClosureDetail {
  branchId: { name: string } | null;
  cashierId: { name: string } | null;
  openedAt: string;
  closedAt?: string;
  status: "OPEN" | "CLOSED";
  reportType?: "X" | "Z";
  initialCash: number;
  initialNequi: number;
  declaredCash?: number;
  systemCalculatedCash?: number;
  difference?: number;
  declaredNequi?: number;
  systemCalculatedNequi?: number;
  nequiDifference?: number;
  openingStockVerification?: StockVerification;
  closingStockVerification?: StockVerification;
}

interface Financials {
  cashSales: number;
  cardTotal: number;
  nequiTotal: number;
  appsTotal: number;
  pettyCashExpenses: number;
  cashPurchases: number;
}

/** Tabla de inventario reportado (apertura o cierre) — misma info que
 * `openShift`/`closeShift` guardan en `ProductStock`/`Product` al momento
 * exacto de cada uno (`buildStockSnapshot`, ver `cashClosureController.ts`),
 * a diferencia de la vista del cajero (`StockVerificationV2.tsx`) esta SÍ
 * muestra precio/valor total — es una auditoría para el admin, no un flujo
 * operativo donde eso solo distraería. */
function StockSnapshotTable({ title, verification }: { title: string; verification?: StockVerification }) {
  if (!verification) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-neutral-700 mb-2">{title}</h4>
        <p className="text-xs text-neutral-400">Sin datos (el turno todavía no llega a este punto).</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-neutral-700">{title}</h4>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            verification.confirmed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {verification.confirmed ? "Coincidió" : "Con diferencia"}
        </span>
      </div>
      {!verification.confirmed && verification.annotation && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
          {verification.annotation}
        </p>
      )}
      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 sticky top-0">
              <tr className="text-left text-neutral-500">
                <th className="p-2 font-medium">SKU</th>
                <th className="p-2 font-medium">Producto</th>
                <th className="p-2 font-medium text-right">Precio</th>
                <th className="p-2 font-medium text-right">Cant.</th>
                <th className="p-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {verification.snapshot.map((it) => (
                <tr key={it.sku} className="border-t border-neutral-100">
                  <td className="p-2 text-neutral-500">{it.sku}</td>
                  <td className="p-2">{it.name}</td>
                  <td className="p-2 text-right">{money(it.price)}</td>
                  <td className="p-2 text-right">{it.quantity}</td>
                  <td className="p-2 text-right font-medium">{money(it.totalValue)}</td>
                </tr>
              ))}
              {verification.snapshot.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-neutral-400">
                    No había stock registrado en esta sede en ese momento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-neutral-400 mt-1">Verificado: {formatDateTime(verification.verifiedAt)}</p>
    </div>
  );
}

/**
 * Vista de solo lectura del turno reportado por un cajero — botón "Ver" de
 * `FinanzasCaja.tsx` (ver punto 51 de admin-frontend/CLAUDE.md). A
 * diferencia de `CashClosureModal.tsx` (crear/editar), este componente no
 * manda nada al backend, solo muestra `GET /api/admin/cash-closures/:id/
 * detail`.
 */
export default function CashClosureDetailModal({
  closureId,
  onClose,
}: {
  closureId: string;
  onClose: () => void;
}) {
  const [closure, setClosure] = useState<ClosureDetail | null>(null);
  const [financials, setFinancials] = useState<Financials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .getCashClosureDetail(closureId)
      .then((res) => {
        setClosure(res.closure);
        setFinancials(res.financials);
      })
      .catch((err: any) => setError(err.message || "No se pudo cargar el turno"))
      .finally(() => setLoading(false));
  }, [closureId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Detalle del turno</h3>
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

          {closure && financials && (
            <>
              {/* Sede/cajero/estado + inicio y fin real del turno — openedAt/
                  closedAt son los timestamps de cuando el cajero llenó
                  "Iniciar turno"/"Cerrar turno" en el POS (ver
                  openShift/closeShift en cashClosureController.ts), no una
                  fecha estimada. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-400">Sede</p>
                  <p className="font-medium">{closure.branchId?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Cajero</p>
                  <p className="font-medium">{closure.cashierId?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Turno iniciado</p>
                  <p className="font-medium">{formatDateTime(closure.openedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Turno cerrado</p>
                  <p className="font-medium">
                    {closure.closedAt ? formatDateTime(closure.closedAt) : "Todavía abierto"}
                  </p>
                </div>
              </div>

              {/* Ventas por método de pago — mismo lenguaje visual que el
                  resumen que ya ve el cajero al cerrar (ShiftSummary en
                  cajero/components/modals/ShiftModal.tsx), recalculado en
                  el momento (GET .../detail) acotado a [openedAt, closedAt]
                  en vez de leído de campos sueltos del documento. */}
              <div>
                <h4 className="text-sm font-semibold text-neutral-700 mb-2">Ventas por método de pago</h4>
                <div className="rounded-lg overflow-hidden border border-neutral-200">
                  <div className="grid grid-cols-4 text-center text-xs">
                    <div className="bg-green-100 text-green-700 font-semibold py-1.5">Efectivo</div>
                    <div className="bg-purple-100 text-purple-700 font-semibold py-1.5">Nequi</div>
                    <div className="bg-blue-100 text-blue-700 font-semibold py-1.5">Datáfono</div>
                    <div className="bg-orange-100 text-orange-700 font-semibold py-1.5">Apps</div>
                  </div>
                  <div className="grid grid-cols-4 text-center text-xs font-semibold">
                    <div className="py-2 border-r border-neutral-100">{money(financials.cashSales)}</div>
                    <div className="py-2 border-r border-neutral-100">{money(financials.nequiTotal)}</div>
                    <div className="py-2 border-r border-neutral-100">{money(financials.cardTotal)}</div>
                    <div className="py-2">{money(financials.appsTotal)}</div>
                  </div>
                </div>
              </div>

              {/* Efectivo y Nequi: base, declarado por el cajero, esperado
                  por el sistema y diferencia — mismos campos que ya vivían
                  en el documento (declaredCash/systemCalculatedCash/etc,
                  llenados por closeShift), no recalculados acá. */}
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="border border-neutral-200 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold text-neutral-700 mb-1">Efectivo</p>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Base inicial</span>
                    <span>{money(closure.initialCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Compras (efectivo)</span>
                    <span>{money(financials.cashPurchases)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Gastos de caja menor</span>
                    <span>{money(financials.pettyCashExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Esperado</span>
                    <span>{money(closure.systemCalculatedCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-neutral-100 pt-1">
                    <span>Declarado</span>
                    <span>{money(closure.declaredCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Diferencia</span>
                    <span
                      className={
                        closure.difference === undefined || closure.difference === 0
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {money(closure.difference)}
                    </span>
                  </div>
                </div>
                <div className="border border-neutral-200 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold text-neutral-700 mb-1">Nequi</p>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Base inicial</span>
                    <span>{money(closure.initialNequi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Esperado</span>
                    <span>{money(closure.systemCalculatedNequi)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-neutral-100 pt-1">
                    <span>Declarado</span>
                    <span>{money(closure.declaredNequi)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Diferencia</span>
                    <span
                      className={
                        closure.nequiDifference === undefined || closure.nequiDifference === 0
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {money(closure.nequiDifference)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verificación de inventario — apertura y cierre, cada una
                  con el snapshot completo de ProductStock/Product tal como
                  estaba en ese instante exacto. */}
              <div className="grid sm:grid-cols-2 gap-4">
                <StockSnapshotTable title="Inventario al abrir" verification={closure.openingStockVerification} />
                <StockSnapshotTable title="Inventario al cerrar" verification={closure.closingStockVerification} />
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="bg-neutral-100 rounded-lg py-2 px-4 text-sm font-medium">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
