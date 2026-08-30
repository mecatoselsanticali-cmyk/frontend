import { useEffect, useState } from "react";
import { usePosStore } from "../../store/posStore";
import { posApi } from "../../services/posApi";

type Step = "CHOOSE" | "OPEN" | "CLOSE" | "RESULT";

interface StockSnapshotItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  totalValue: number;
}

/**
 * Tabla de stock actual + confirmación, reutilizada tanto en apertura como
 * en cierre de turno (mismo modal en ambos casos, ver CLAUDE.md) — el
 * cajero cuenta físicamente el inventario y o bien confirma que coincide,
 * o marca que no y describe la diferencia en una anotación. El snapshot
 * que ve acá es el mismo que el backend vuelve a calcular y guarda al
 * confirmar (no se manda de vuelta al servidor, solo el resultado de la
 * verificación).
 */
function StockVerification({
  confirmed,
  onConfirmedChange,
  annotation,
  onAnnotationChange,
}: {
  confirmed: boolean | null;
  onConfirmedChange: (v: boolean) => void;
  annotation: string;
  onAnnotationChange: (v: string) => void;
}) {
  const [items, setItems] = useState<StockSnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    posApi
      .getStockSnapshot()
      .then(setItems)
      .catch((err: any) => setError(err.message || "No se pudo cargar el stock"))
      .finally(() => setLoading(false));
  }, []);

  const total = items.reduce((acc, it) => acc + it.totalValue, 0);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-700">Verificación de stock</h4>

      {loading && <p className="text-xs text-neutral-400">Cargando stock...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && !error && (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
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
                {items.map((it) => (
                  <tr key={it.sku} className="border-t border-neutral-100">
                    <td className="p-2 text-neutral-500">{it.sku}</td>
                    <td className="p-2">{it.name}</td>
                    <td className="p-2 text-right">${it.price.toLocaleString("es-CO")}</td>
                    <td className="p-2 text-right">{it.quantity}</td>
                    <td className="p-2 text-right font-medium">
                      ${it.totalValue.toLocaleString("es-CO")}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-neutral-400">
                      No hay stock registrado en esta sede
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center bg-neutral-50 border-t border-neutral-200 p-2 text-xs font-semibold">
            <span>Valor total del inventario</span>
            <span>${total.toLocaleString("es-CO")}</span>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs text-neutral-500 mb-1.5">¿El stock físico coincide con esta tabla?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirmedChange(true)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium border-2 transition-colors ${
              confirmed === true
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            Sí, coincide
          </button>
          <button
            type="button"
            onClick={() => onConfirmedChange(false)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium border-2 transition-colors ${
              confirmed === false
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            No, hay diferencia
          </button>
        </div>
      </div>

      {confirmed === false && (
        <div>
          <label className="text-xs text-neutral-500">Describe la diferencia encontrada</label>
          <textarea
            value={annotation}
            onChange={(e) => onAnnotationChange(e.target.value)}
            className="w-full mt-1 border border-neutral-200 rounded-lg p-2 text-sm"
            rows={2}
            placeholder="Ej. Faltan 3 unidades de Empanada Grande"
          />
        </div>
      )}
    </div>
  );
}

interface ShiftSummaryData {
  initialCash: number;
  initialNequi: number;
  cashSales: number;
  cardTotal: number;
  nequiTotal: number;
  appsTotal: number;
  pettyCashExpenses: number;
  systemCalculatedCash: number;
  systemCalculatedNequi: number;
}

/**
 * Resumen de ventas/gastos del turno, mostrado en el cierre ANTES de que
 * el cajero declare el efectivo/Nequi contado — a pedido explícito del
 * negocio esto ya no es un arqueo ciego (antes el cálculo solo se
 * revelaba después de declarar, en la pantalla de Resultado). Viene de
 * `GET /api/pos/shifts/:id/summary`, que reutiliza el mismo cálculo que
 * hace `closeShift` al cerrar de verdad (`computeShiftFinancials` en el
 * backend), así que el número que ve acá el cajero es exactamente el que
 * se usará para calcular la diferencia al confirmar.
 */
function ShiftSummary({ shiftId }: { shiftId: string }) {
  const [summary, setSummary] = useState<ShiftSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    posApi
      .getShiftSummary(shiftId)
      .then(setSummary)
      .catch((err: any) => setError(err.message || "No se pudo cargar el resumen"))
      .finally(() => setLoading(false));
  }, [shiftId]);

  if (loading) return <p className="text-xs text-neutral-400 mb-4">Cargando resumen del turno...</p>;
  if (error) return <p className="text-xs text-red-500 mb-4">{error}</p>;
  if (!summary) return null;

  return (
    <div className="border border-neutral-200 rounded-lg p-3 space-y-3 mb-5">
      <h4 className="text-sm font-semibold text-neutral-700">Resumen del turno</h4>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-neutral-500">Base inicial en efectivo</span>
          <span>${summary.initialCash.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">+ Ventas en efectivo</span>
          <span>${summary.cashSales.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">- Gastos de caja menor</span>
          <span>${summary.pettyCashExpenses.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between font-bold border-t border-neutral-100 pt-1">
          <span>= Efectivo esperado</span>
          <span>${summary.systemCalculatedCash.toLocaleString("es-CO")}</span>
        </div>
      </div>

      <div className="space-y-1 text-xs pt-1 border-t border-neutral-100">
        <div className="flex justify-between">
          <span className="text-neutral-500">Base inicial en Nequi</span>
          <span>${summary.initialNequi.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">+ Ventas en Nequi</span>
          <span>${summary.nequiTotal.toLocaleString("es-CO")}</span>
        </div>
        <div className="flex justify-between font-bold border-t border-neutral-100 pt-1">
          <span>= Nequi esperado</span>
          <span>${summary.systemCalculatedNequi.toLocaleString("es-CO")}</span>
        </div>
      </div>

      <div className="flex justify-between text-xs pt-1 border-t border-neutral-100 text-neutral-500">
        <span>Ventas tarjeta: ${summary.cardTotal.toLocaleString("es-CO")}</span>
        <span>Ventas apps: ${summary.appsTotal.toLocaleString("es-CO")}</span>
      </div>
    </div>
  );
}

export default function ShiftModal() {
  const closeModal = usePosStore((s) => s.closeModal);
  // El id del turno abierto vive en el store (fuente de verdad
  // confirmada por el servidor, ver Caja.tsx), no en localStorage — un id
  // guardado en el cliente sin verificar contra el backend fue la causa
  // real de un bug ya corregido ("Turno no encontrado" indefinidamente,
  // ver punto 30 de CLAUDE.md).
  const shiftId = usePosStore((s) => s.shiftId);
  const setShiftId = usePosStore((s) => s.setShiftId);
  // Arranca directo en OPEN o CLOSE según si ya hay un turno abierto — el
  // paso CHOOSE nunca ofreció una elección real (siempre mostraba un solo
  // botón posible según `shiftId`, más "Cancelar"), así que era un paso
  // intermedio redundante. Sigue existiendo como destino de recuperación
  // tras "Turno no encontrado" (ver más abajo), no como punto de entrada.
  const [step, setStep] = useState<Step>(() => (shiftId ? "CLOSE" : "OPEN"));
  const [initialCash, setInitialCash] = useState("");
  const [initialNequi, setInitialNequi] = useState("");
  const [declaredCash, setDeclaredCash] = useState("");
  const [declaredNequi, setDeclaredNequi] = useState("");
  const [stockConfirmed, setStockConfirmed] = useState<boolean | null>(null);
  const [stockAnnotation, setStockAnnotation] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmitStock = stockConfirmed === true || (stockConfirmed === false && Boolean(stockAnnotation));

  const openShift = async () => {
    if (!canSubmitStock) return;
    setLoading(true);
    setError("");
    try {
      const shift = await posApi.openShift({
        initialCash: Number(initialCash) || 0,
        initialNequi: Number(initialNequi) || 0,
        stockConfirmed: Boolean(stockConfirmed),
        stockAnnotation: stockAnnotation || undefined,
      });
      setShiftId(shift._id);
      closeModal();
    } catch (err: any) {
      setError(err.message || "No se pudo abrir el turno");
    } finally {
      setLoading(false);
    }
  };

  const closeShift = async (reportType: "X" | "Z") => {
    if (!shiftId || !canSubmitStock) return;
    setLoading(true);
    setError("");
    try {
      const res = await posApi.closeShift(shiftId, {
        declaredCash: Number(declaredCash) || 0,
        declaredNequi: Number(declaredNequi) || 0,
        reportType,
        stockConfirmed: Boolean(stockConfirmed),
        stockAnnotation: stockAnnotation || undefined,
      });
      setResult(res);
      if (reportType === "Z") {
        setShiftId(null);
      }
      setStep("RESULT");
    } catch (err: any) {
      // El id guardado en el store puede apuntar a un turno que ya no
      // existe del lado del servidor (ej. se borró desde el panel admin,
      // o se abrió en otra sesión/dispositivo y se cerró desde ahí) — sin
      // esto, el cajero quedaba atascado en "Cerrar turno" para siempre,
      // viendo "Turno no encontrado" en cada intento, sin forma de volver
      // a abrir uno nuevo. Al detectar ese error puntual, se limpia el id
      // guardado y se vuelve a la pantalla inicial para que pueda abrir
      // un turno nuevo.
      if (err.message?.includes("Turno no encontrado")) {
        setShiftId(null);
        setStep("CHOOSE");
        setError("Ese turno ya no existe — puedes abrir uno nuevo.");
        return;
      }
      setError(err.message || "No se pudo cerrar el turno");
    } finally {
      setLoading(false);
    }
  };

  const goToStep = (next: Step) => {
    setStockConfirmed(null);
    setStockAnnotation("");
    setError("");
    setStep(next);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 !m-0 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {step === "CHOOSE" && (
          <>
            <h3 className="text-lg font-bold mb-4">Turno de caja</h3>
            {error && <p className="text-amber-600 text-xs mb-3">{error}</p>}
            <div className="flex flex-col gap-2">
              {!shiftId && (
                <button
                  onClick={() => goToStep("OPEN")}
                  className="bg-brand-600 text-white rounded-lg py-3 text-sm font-medium"
                >
                  Abrir turno
                </button>
              )}
              {shiftId && (
                <button
                  onClick={() => goToStep("CLOSE")}
                  className="bg-brand-600 text-white rounded-lg py-3 text-sm font-medium"
                >
                  Cerrar turno / Arqueo
                </button>
              )}
              <button onClick={closeModal} className="bg-neutral-100 rounded-lg py-2 text-sm">
                Cancelar
              </button>
            </div>
          </>
        )}

        {step === "OPEN" && (
          <>
            <h3 className="text-lg font-bold mb-4">Apertura de turno</h3>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-xs text-neutral-500">Base inicial en efectivo</label>
                <input
                  type="number"
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  className="w-full mt-1 border border-neutral-200 rounded-lg p-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Base inicial en cuentas (Nequi)</label>
                <input
                  type="number"
                  value={initialNequi}
                  onChange={(e) => setInitialNequi(e.target.value)}
                  className="w-full mt-1 border border-neutral-200 rounded-lg p-2"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mb-4">
              <StockVerification
                confirmed={stockConfirmed}
                onConfirmedChange={setStockConfirmed}
                annotation={stockAnnotation}
                onAnnotationChange={setStockAnnotation}
              />
            </div>

            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm">
                Cancelar
              </button>
              <button
                onClick={openShift}
                disabled={loading || !canSubmitStock}
                className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
              >
                {loading ? "Abriendo..." : "Abrir"}
              </button>
            </div>
          </>
        )}

        {step === "CLOSE" && (
          <>
            <h3 className="text-lg font-bold mb-2">Cierre de turno / Arqueo</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Revisa el resumen de tu turno, cuenta tu efectivo y saldo de cuentas físicamente,
              y regístralos abajo.
            </p>

            {shiftId && <ShiftSummary shiftId={shiftId} />}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-xs text-neutral-500">Efectivo contado</label>
                <input
                  type="number"
                  value={declaredCash}
                  onChange={(e) => setDeclaredCash(e.target.value)}
                  className="w-full mt-1 border border-neutral-200 rounded-lg p-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Saldo en cuentas (Nequi)</label>
                <input
                  type="number"
                  value={declaredNequi}
                  onChange={(e) => setDeclaredNequi(e.target.value)}
                  className="w-full mt-1 border border-neutral-200 rounded-lg p-2"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mb-4">
              <StockVerification
                confirmed={stockConfirmed}
                onConfirmedChange={setStockConfirmed}
                annotation={stockAnnotation}
                onAnnotationChange={setStockAnnotation}
              />
            </div>

            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => closeShift("X")}
                disabled={loading || !canSubmitStock}
                className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm disabled:opacity-50"
              >
                Reporte X (parcial)
              </button>
              <button
                onClick={() => closeShift("Z")}
                disabled={loading || !canSubmitStock}
                className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
              >
                Reporte Z (cierre)
              </button>
            </div>
            <button onClick={closeModal} className="w-full bg-neutral-50 rounded-lg py-2 text-xs">
              Cancelar
            </button>
          </>
        )}

        {step === "RESULT" && result && (
          <>
            <h3 className="text-lg font-bold mb-4">
              Resultado {result.shift.reportType === "Z" ? "Cierre Z" : "Corte X"}
            </h3>
            <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-neutral-500">Efectivo declarado</span>
                <span>${result.shift.declaredCash?.toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Efectivo esperado</span>
                <span>${result.shift.systemCalculatedCash?.toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between font-bold pb-2 border-b border-neutral-100">
                <span>Diferencia en efectivo</span>
                <span className={result.shift.difference ? "text-red-500" : "text-green-600"}>
                  ${result.shift.difference?.toLocaleString("es-CO")}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-neutral-500">Nequi declarado</span>
                <span>${result.shift.declaredNequi?.toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Nequi esperado</span>
                <span>${result.shift.systemCalculatedNequi?.toLocaleString("es-CO")}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Diferencia en Nequi</span>
                <span className={result.shift.nequiDifference ? "text-red-500" : "text-green-600"}>
                  ${result.shift.nequiDifference?.toLocaleString("es-CO")}
                </span>
              </div>
            </div>
            {result.shift.closingStockVerification?.confirmed === false && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg p-3 mb-4">
                <strong>Diferencia de stock reportada:</strong>{" "}
                {result.shift.closingStockVerification.annotation}
              </div>
            )}
            <button
              onClick={closeModal}
              className="w-full bg-brand-600 text-white rounded-lg py-2 text-sm"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
