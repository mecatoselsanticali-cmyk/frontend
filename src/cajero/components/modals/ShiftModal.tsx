import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { usePosStore } from "../../store/posStore";
import { posApi } from "../../services/posApi";
import StockVerificationV2, { type StockVerificationV2Summary } from "./StockVerificationV2";

type Step = "CHOOSE" | "OPEN" | "CLOSE" | "RESULT";

interface ShiftSummaryData {
  initialCash: number;
  initialNequi: number;
  cashSales: number;
  cardTotal: number;
  nequiTotal: number;
  appsTotal: number;
  pettyCashExpenses: number;
  cashPurchases: number;
  systemCalculatedCash: number;
  systemCalculatedNequi: number;
}

function money(n: number) {
  return `$${n.toLocaleString("es-CO")}`;
}

/** Una fila de una de las dos tablas de desglose (Efectivo / Nequi y Datáfono) — ver `ShiftSummary`. */
function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between px-3 py-1.5 text-xs border-t border-neutral-100 ${
        bold ? "font-bold" : "text-neutral-600"
      }`}
    >
      <span>{label}</span>
      <span className={bold ? (value < 0 ? "text-red-600" : "text-neutral-800") : undefined}>
        {money(value)}
      </span>
    </div>
  );
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
 *
 * Rediseñado como una tabla tipo hoja de cálculo (ver punto 48 de
 * CLAUDE.md) — fila superior con el total vendido por cada método de
 * pago, y debajo dos columnas de desglose: Efectivo (única con
 * Compras/Gastos, porque son los únicos movimientos que de verdad salen
 * de la gaveta física) y Nequi y Datáfono combinados (informativo — el
 * "Total" de esta columna NO es lo que el cajero declara al cerrar, ver
 * la nota en el JSX de abajo).
 */
function ShiftSummary({
  shiftId,
  boxRef,
}: {
  shiftId: string;
  /** Ref callback puesto en la caja con borde (NO en el `<h4>` de arriba
   * ni en el wrapper completo) — así `ShiftModal.tsx` mide exactamente
   * lo mismo que `StockVerificationV2` copia como su propia altura. Un
   * callback ref (no `useRef` normal) porque este componente devuelve
   * `null` mientras `loading`/`error`/sin datos — un `useRef` fijo
   * nunca se "reengancharía" solo cuando la caja real aparece después
   * de la carga async; un callback ref sí se vuelve a invocar cada vez
   * que React monta/desmonta el nodo, incluida la primera vez que
   * realmente existe. */
  boxRef?: (el: HTMLDivElement | null) => void;
}) {
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

  // "Nequi y Datáfono" es una columna puramente informativa (ver el
  // comentario de arriba de la función) — combina lo vendido por ambos
  // medios electrónicos para que el cajero/admin vea el total digital de
  // un vistazo, pero el campo que el cajero realmente declara al cerrar
  // (`declaredNequi`, más abajo en este mismo modal) y la diferencia que
  // calcula el backend (`systemCalculatedNequi`) siguen siendo SOLO
  // Nequi — el dinero de una venta con datáfono nunca entra al saldo de
  // la app Nequi, así que sumarlo ahí generaría una diferencia que el
  // cajero jamás podría cuadrar. "Compras Nequi"/"Gastos Nequi" quedan en
  // $0 siempre en este sistema (las compras y los gastos de caja menor
  // del cajero solo existen en efectivo, ver `computeShiftFinancials` en
  // el backend) — se muestran igual, en vez de omitirse, para que la
  // tabla quede simétrica con la de Efectivo.
  const nequiAndCardSales = summary.nequiTotal + summary.cardTotal;
  const nequiAndCardTotal = summary.initialNequi + nequiAndCardSales;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-700">Resumen del turno</h4>
      <div ref={boxRef} className="rounded-lg overflow-hidden border border-neutral-200">
        {/* Fila superior: total vendido por cada método de pago */}
        <div className="grid grid-cols-4 text-center text-xs">
          <div className="bg-green-100 text-green-700 font-semibold py-1.5">Efectivo</div>
          <div className="bg-purple-100 text-purple-700 font-semibold py-1.5">Nequi</div>
          <div className="bg-blue-100 text-blue-700 font-semibold py-1.5">Datáfono</div>
          <div className="bg-orange-100 text-orange-700 font-semibold py-1.5">Apps</div>
        </div>
        <div className="grid grid-cols-4 text-center text-xs font-semibold border-b border-neutral-200">
          <div className="py-2 border-r border-neutral-100">{money(summary.cashSales)}</div>
          <div className="py-2 border-r border-neutral-100">{money(summary.nequiTotal)}</div>
          <div className="py-2 border-r border-neutral-100">{money(summary.cardTotal)}</div>
          <div className="py-2">{money(summary.appsTotal)}</div>
        </div>

        {/* Dos tablas de desglose: Efectivo / Nequi y Datáfono */}
        <div className="grid grid-cols-2 divide-x divide-neutral-200">
          <div>
            <div className="bg-green-50 text-green-700 text-xs font-semibold text-center py-1.5">Efectivo</div>
            <SummaryRow label="Base inicial" value={summary.initialCash} />
            <SummaryRow label="Ventas Efectivo" value={summary.cashSales} />
            <SummaryRow label="Compras" value={summary.cashPurchases} />
            <SummaryRow label="Gastos" value={summary.pettyCashExpenses} />
            <SummaryRow label="Total" value={summary.systemCalculatedCash} bold />
          </div>
          <div>
            <div className="bg-purple-50 text-purple-700 text-xs font-semibold text-center py-1.5">
              Nequi y Datáfono
            </div>
            <SummaryRow label="Base inicial" value={summary.initialNequi} />
            <SummaryRow label="Ventas Cuentas" value={nequiAndCardSales} />
            <SummaryRow label="Compras Nequi" value={0} />
            <SummaryRow label="Gastos Nequi" value={0} />
            <SummaryRow label="Total" value={nequiAndCardTotal} bold />
          </div>
        </div>
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
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [v2Summary, setV2Summary] = useState<StockVerificationV2Summary>({
    allResolved: false,
    corrections: [],
  });

  // Altura real de la caja de `ShiftSummary` (paso CLOSE), medida en vivo
  // con `ResizeObserver` — la caja de `StockVerificationV2` la copia
  // (`boxHeight` prop) en vez de usar un valor fijo adivinado, para que
  // ambas queden exactamente iguales sin importar cómo cambie el
  // contenido de `ShiftSummary` a futuro.
  //
  // `summaryBoxEl` es un ref CALLBACK guardado en estado, no un
  // `useRef` normal — necesario porque `ShiftSummary` devuelve `null`
  // mientras `loading`/`error`/sin datos (carga async): con un `useRef`
  // fijo, el `useEffect` de acá correría una sola vez al montar, antes
  // de que la caja real exista en el DOM, y nunca se enteraría de que
  // apareció después. Un ref callback SÍ se vuelve a invocar cada vez
  // que React monta/desmonta ese nodo específico — incluida la primera
  // vez que de verdad existe — así que guardarlo en estado dispara este
  // efecto en el momento correcto.
  const [summaryBoxEl, setSummaryBoxEl] = useState<HTMLDivElement | null>(null);
  const [summaryBoxHeight, setSummaryBoxHeight] = useState<number>();

  useEffect(() => {
    if (!summaryBoxEl) return;
    // `entry.contentRect.height` mide el content-box (excluye el borde de
    // 1px de la caja) — pero el `boxHeight` que recibe StockVerificationV2
    // se aplica como `style={{ height }}`, que con `box-sizing:
    // border-box` (el reset global de Tailwind) fija el alto TOTAL con
    // borde incluido. Usar `contentRect.height` ahí producía una caja 2px
    // más baja que `ShiftSummary` (el borde de arriba + abajo). Medir con
    // `getBoundingClientRect()` en su lugar da el alto real de la caja
    // completa, con borde, que es lo que hay que igualar.
    const observer = new ResizeObserver(() => {
      setSummaryBoxHeight(summaryBoxEl.getBoundingClientRect().height);
    });
    observer.observe(summaryBoxEl);
    return () => observer.disconnect();
  }, [summaryBoxEl]);

  const canSubmitStock = v2Summary.allResolved;

  // Traduce el resultado de `StockVerificationV2` (confirmar/corregir por
  // fila, sin un "confirmado"/"anotación" global) al shape que
  // `openShift`/`closeShift` ya esperaban (`stockConfirmed`/
  // `stockAnnotation`) — esos dos endpoints no cambiaron. Si ninguna fila
  // se corrigió, se manda `stockConfirmed: true` (coincide todo); si al
  // menos una se corrigió, `stockConfirmed: false` con una anotación
  // generada a partir de esas correcciones.
  const buildStockPayload = (): { stockConfirmed: boolean; stockAnnotation?: string } => {
    if (v2Summary.corrections.length === 0) {
      return { stockConfirmed: true };
    }
    const annotation = `Verificación por fila: ${v2Summary.corrections
      .map((c) => `${c.name} (${c.sku}) → ${c.quantity} uds`)
      .join("; ")}`;
    return { stockConfirmed: false, stockAnnotation: annotation };
  };

  const openShift = async () => {
    if (!canSubmitStock) return;
    setLoading(true);
    setError("");
    try {
      const shift = await posApi.openShift({
        initialCash: Number(initialCash) || 0,
        initialNequi: Number(initialNequi) || 0,
        ...buildStockPayload(),
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
        ...buildStockPayload(),
      });
      setResult(res);
      if (reportType === "Z") {
        setShiftId(null);
        toast.success("Turno cerrado correctamente");
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
    setV2Summary({ allResolved: false, corrections: [] });
    setError("");
    setStep(next);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 !m-0 p-4">
      <div
        className={`relative bg-white rounded-2xl p-6 w-full max-h-[100vh] overflow-y-auto shadow-xl ${
          step === "CLOSE" ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        {/* Cierre desde la esquina, en las 4 pantallas del modal (además
            de "Cancelar" en cada una) — un solo botón fuera del switch de
            pasos, en vez de repetirlo en cada bloque `step === "..."`. */}
        <button
          type="button"
          onClick={closeModal}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 text-xl leading-none"
        >
          ✕
        </button>

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
                  Cerrar turno 
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
              <StockVerificationV2 onSummaryChange={setV2Summary} />
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
            <h3 className="text-lg font-bold mb-2">Cierre de turno</h3>
            
            <p className="text-xs text-neutral-500 mb-4">
              Revisa el resumen de tu turno, cuenta tu efectivo y saldo de cuentas físicamente,
              y regístralos abajo.
            </p>

            {/* Resumen y verificación de inventario alineados en la misma
                fila (mismo patrón de encabezado-arriba-de-caja en ambos
                componentes, ver ShiftSummary/StockVerificationV2 — antes
                el resumen tenía su título DENTRO del borde y el otro
                afuera, lo que los desalineaba visualmente aunque
                estuvieran en la misma grilla). Los inputs de efectivo/
                Nequi declarado quedan en su propia fila de ancho
                completo debajo, en vez de metidos dentro de la columna
                izquierda. `md:` es el mismo breakpoint (768px) que ya usa
                el resto del panel para responsividad (ver punto 36 de
                admin-frontend/CLAUDE.md) — por debajo de eso ambas cajas
                vuelven a apilarse, aunque en la práctica un celular real
                nunca llega a ver esto (se bloquea antes, ver punto 39). */}
            <div className="grid md:grid-cols-2 gap-6 mb-5 items-start">
              {shiftId && <ShiftSummary shiftId={shiftId} boxRef={setSummaryBoxEl} />}
              <StockVerificationV2 onSummaryChange={setV2Summary} boxHeight={summaryBoxHeight} />
            </div>

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

            {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm">
                Cancelar
              </button>
              <button
                onClick={() => closeShift("Z")}
                disabled={loading || !canSubmitStock}
                className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
              >
                Cerrar turno
              </button>
            </div>
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
                <strong>Diferencia de inventario reportada:</strong>{" "}
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
