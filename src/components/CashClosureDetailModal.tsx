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

interface PurchaseRow {
  _id: string;
  concept: string;
  amount: number;
  createdAt: string;
  productId?: { name: string } | null;
}

interface ExpenseRow {
  _id: string;
  concept: string;
  amount: number;
  createdAt: string;
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

/** Tabla simple de compras o gastos del turno (ítem + monto) — ver punto 55
 * de admin-frontend/CLAUDE.md. Mismo shell visual que `StockSnapshotTable`
 * de arriba, pero con solo 2 columnas: acá no hace falta precio/cantidad,
 * el pedido explícito fue "descripción y monto pagado" nada más.
 *
 * `columnLabel`/`getLabel` son configurables porque compras y gastos
 * muestran cosas distintas en esa primera columna: gastos usa `concept`
 * (texto libre, no hay un modelo detrás), pero compras muestra el
 * PRODUCTO real comprado (`productId.name`, poblado por el backend) en
 * vez de `concept` — pedido explícito de que el admin vea el ítem
 * concreto, no la frase genérica "Compra de stock: X" completa.
 *
 * El contenedor scrolleable usa una altura FIJA (`h-56`, no `max-h-56`)
 * — con `max-h` el bloque se encogía cuando había pocas filas, haciendo
 * que el modal completo cambiara de tamaño según cuánto tuviera cada
 * turno; con altura fija el tamaño de esta tabla (y por lo tanto el
 * layout del modal) no depende de la cantidad de filas, mismo criterio
 * que el modal contenedor (ver el componente de más abajo). */
function ConceptAmountTable<T extends { _id: string; concept: string; amount: number; createdAt: string }>({
  title,
  rows,
  emptyMessage,
  columnLabel = "Descripción",
  getLabel = (r) => r.concept,
}: {
  title: string;
  rows: T[];
  emptyMessage: string;
  columnLabel?: string;
  getLabel?: (row: T) => React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-neutral-700 mb-2">{title}</h4>
      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <div className="h-56 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 sticky top-0">
              <tr className="text-left text-neutral-500">
                <th className="p-2 font-medium">{columnLabel}</th>
                <th className="p-2 font-medium text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-neutral-100">
                  <td className="p-2">
                    {getLabel(r)}
                    <span className="block text-neutral-400">{formatDateTime(r.createdAt)}</span>
                  </td>
                  <td className="p-2 text-right font-medium">{money(r.amount)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-3 text-center text-neutral-400">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .getCashClosureDetail(closureId)
      .then((res) => {
        setClosure(res.closure);
        setFinancials(res.financials);
        setPurchases(res.purchases || []);
        setExpenses(res.expenses || []);
      })
      .catch((err: any) => setError(err.message || "No se pudo cargar el turno"))
      .finally(() => setLoading(false));
  }, [closureId]);

  // Altura FIJA (`h-[85vh]`, no `max-h-[90vh]`) con el header/footer fuera
  // del área que scrollea — antes el modal entero crecía/encogía según
  // cuánto turno tuviera cada cierre (poco stock/sin compras = modal
  // chico, mucho de todo = modal casi a pantalla completa), lo que hacía
  // que el header y el botón "Cerrar" se movieran de lugar entre un
  // registro y otro. Con altura fija + `overflow-y-auto` solo en el
  // cuerpo, el modal se ve igual siempre y el contenido de más scrollea
  // adentro, mismo criterio que las tablas de abajo (ver
  // `ConceptAmountTable`).
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-3xl h-[85vh] shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 border-b border-neutral-100">
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                  {/* Sin columna "Datáfono" a propósito — el negocio no
                      recibe pagos con tarjeta (ver punto 61 de CLAUDE.md).
                      `financials.cardTotal` sigue existiendo del lado del
                      backend (turnos viejos con ventas CARD reales lo
                      calculan bien), simplemente ya no se muestra acá. */}
                  <div className="grid grid-cols-3 text-center text-xs">
                    <div className="bg-green-100 text-green-700 font-semibold py-1.5">Efectivo</div>
                    <div className="bg-purple-100 text-purple-700 font-semibold py-1.5">Nequi</div>
                    <div className="bg-orange-100 text-orange-700 font-semibold py-1.5">Apps</div>
                  </div>
                  <div className="grid grid-cols-3 text-center text-xs font-semibold">
                    <div className="py-2 border-r border-neutral-100">{money(financials.cashSales)}</div>
                    <div className="py-2 border-r border-neutral-100">{money(financials.nequiTotal)}</div>
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

              {/* Compras y gastos registrados por el cajero durante el
                  turno (ver punto 55 de CLAUDE.md) — lista completa
                  (cualquier método de pago/categoría), no solo el
                  subconjunto en efectivo que ya resume "Compras (efectivo)"
                  arriba. */}
              <div className="grid sm:grid-cols-2 gap-4">
                <ConceptAmountTable
                  title="Compras del turno"
                  rows={purchases}
                  emptyMessage="No se registraron compras en este turno"
                  columnLabel="Producto"
                  getLabel={(r) => r.productId?.name || r.concept}
                />
                <ConceptAmountTable
                  title="Gastos del turno"
                  rows={expenses}
                  emptyMessage="No se registraron gastos en este turno"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end p-4 shrink-0 border-t border-neutral-100">
          <button onClick={onClose} className="bg-neutral-100 rounded-lg py-2 px-4 text-sm font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
