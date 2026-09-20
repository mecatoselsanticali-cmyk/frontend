import { useEffect, useRef, useState } from "react";
import { Banknote, Trash2, Coins, type LucideIcon } from "lucide-react";
import { toast } from "react-toastify";
import { usePosStore } from "../store/posStore";
import { generateLocalTicketId } from "../db/offlineDb";
import { posApi } from "../services/posApi";
import SaleReceipt from "./SaleReceipt";
import EmittingReceipt from "./EmittingReceipt";
import ProcessingSaleModal from "./ProcessingSaleModal";
import OrderSummary from "./OrderSummary";
import { DIAN_POLL_INTERVAL_MS, DIAN_POLL_MAX_ATTEMPTS } from "../dianPolling";

// Cuánto esperamos como máximo a que el worker DIAN confirme una venta
// "SPECIAL" antes de mostrar el recibo igual (ver punto 67 en curso de
// backend/CLAUDE.md) — cubre el peor caso real de Siigo (auth + POST +
// hasta 5 sondeos de 2s por el CUFE, ~10s) con margen. Ver
// `cajero/dianPolling.ts` para el detalle de por qué estas dos constantes
// no viven acá adentro.

// "CARD" (Datáfono) se quitó de las opciones a propósito — el negocio solo
// recibe pagos en efectivo, Nequi o Bancolombia, nunca con datáfono, así
// que ese botón nunca se usaba (pedido explícito, ver punto 61 de
// admin-frontend/CLAUDE.md). El tipo sigue incluyendo "CARD"/"CASH"/
// "DELIVERY_APP" porque `Sale.paymentMethod` en el backend todavía los
// acepta como valores históricos (ventas ya registradas antes de este
// cambio) — solo se quitaron de la UI, no del modelo de datos. Ver punto
// 34 de backend/CLAUDE.md para el detalle completo del refactor
// método-de-pago vs. canal.
type PaymentMethod = "CASH" | "NEQUI" | "CARD" | "DELIVERY_APP" | "EFECTIVO" | "BANCOLOMBIA";

const TOPE_CONSUMIDOR_FINAL = 509000;

// Nequi/Bancolombia usan su logo real (public/img/) en vez de un ícono
// genérico de Lucide — a diferencia de Efectivo (sin marca propia que
// mostrar), estos dos SÍ tienen un logo reconocible que el cajero ya
// asocia con el método.
const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon?: LucideIcon; iconSrc?: string }[] = [
  { key: "EFECTIVO", label: "Efectivo", icon: Coins },
  { key: "NEQUI", label: "Nequi", iconSrc: "/img/nequi.webp" },
  { key: "BANCOLOMBIA", label: "Bancolombia", iconSrc: "/img/bancolombia.svg" },
];

export default function PaymentPanel() {
  const order = usePosStore((s) => s.order);
  const clearOrder = usePosStore((s) => s.clearOrder);
  const orderTotal = usePosStore((s) => s.orderTotal());
  const openModal = usePosStore((s) => s.openModal);
  const branchName = usePosStore((s) => s.branchName);
  const cashierName = usePosStore((s) => s.cashierName);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  // "Pedido DiDi" — canal, no método de pago (ver punto 34 de
  // backend/CLAUDE.md). Encendido fuerza/bloquea el método a Bancolombia
  // (el backend igual lo fuerza server-side vía
  // resolvePaymentMethodForChannel, esto es solo para que la UI no
  // prometa algo distinto de lo que en realidad va a quedar guardado).
  const [isDidi, setIsDidi] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  // Solo se enciende para ventas category: "SPECIAL" — mientras es true,
  // se muestra EmittingReceipt en vez de SaleReceipt (ver processSale/
  // pollDianStatus más abajo).
  const [awaitingDian, setAwaitingDian] = useState(false);
  const [saleError, setSaleError] = useState("");
  // Token del polling en curso — se reemplaza en cada nueva venta y se
  // cancela al desmontar, para que un tick tardío de una venta anterior
  // nunca pise el estado de una más reciente.
  const dianPollRef = useRef<{ cancelled: boolean }>({ cancelled: true });

  useEffect(() => {
    return () => {
      dianPollRef.current.cancelled = true;
    };
  }, []);
  // `processing` (estado de React) no basta como candado: un doble-tap en
  // una pantalla táctil puede disparar dos clicks en el mismo tick, antes
  // de que el primer setProcessing(true) llegue a re-renderizar y
  // deshabilitar el botón — eso duplicaba la venta (dos Sale reales, cada
  // una con su propio localTicketId, así que la deduplicación del backend
  // nunca las veía como la misma venta). Un ref se lee/escribe de forma
  // síncrona, así que sí bloquea la segunda invocación a tiempo.
  const processingRef = useRef(false);

  const total = orderTotal;
  const change = cashReceived ? Number(cashReceived) - total : 0;
  //const exceedsTope = total > TOPE_CONSUMIDOR_FINAL;

  // Escucha la confirmación del modal de captura de cliente (REQ-10) para completar el cobro
  useEffect(() => {
    function handleCustomerCaptured(e: Event) {
      const customer = (e as CustomEvent).detail;
      processSale(customer);
    }
    window.addEventListener("mecatos:customer-captured", handleCustomerCaptured as EventListener);
    return () =>
      window.removeEventListener(
        "mecatos:customer-captured",
        handleCustomerCaptured as EventListener
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, selectedMethod]);

  // Escucha la confirmación del selector de billetes/monedas (CashPaymentModal)
  useEffect(() => {
    function handleCashReceived(e: Event) {
      const { amount } = (e as CustomEvent).detail;
      setCashReceived(String(amount));
    }
    window.addEventListener("mecatos:cash-received", handleCashReceived as EventListener);
    return () => window.removeEventListener("mecatos:cash-received", handleCashReceived as EventListener);
  }, []);

  // Escucha la respuesta "No" del InvoicePromptModal — "Sí" en cambio abre
  // CUSTOMER directamente (ver ese modal), que dispara
  // mecatos:customer-captured arriba y termina en el mismo processSale().
  useEffect(() => {
    function handleInvoiceDeclined() {
      processSale();
    }
    window.addEventListener("mecatos:invoice-declined", handleInvoiceDeclined as EventListener);
    return () =>
      window.removeEventListener("mecatos:invoice-declined", handleInvoiceDeclined as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, selectedMethod]);

  const finalizeSale = async () => {
    if (order.length === 0 || !selectedMethod) return;

    // REQ-10: si supera el tope, la captura de datos del cliente ya es
    // obligatoria — se salta la pregunta de "¿quieres factura?" (no tiene
    // sentido preguntar algo que la ley ya exige) y se va directo a
    // CUSTOMER, igual que antes de este cambio.
    /** 
    if (exceedsTope) {
      openModal("CUSTOMER");
      return;
    }
      */

    // Por debajo del tope, la factura electrónica es voluntaria — se le
    // pregunta al cliente antes de cobrar (InvoicePromptModal). "Sí" abre
    // CUSTOMER para capturar sus datos; "No" dispara
    // mecatos:invoice-declined, que el listener de arriba escucha para
    // completar el cobro sin datos de cliente.
    openModal("INVOICE_PROMPT");
  };

  // Ver punto 67 en curso de backend/CLAUDE.md (diseño "Opción A"): createSale
  // sigue respondiendo de inmediato sin importar el resultado de la emisión
  // DIAN — esto solo consulta, del lado del cliente, cuándo terminó. Nunca
  // deja al cajero atrapado: si se agotan los intentos, se muestra el
  // recibo igual (mismo criterio del punto 31 de src/cajero/CLAUDE.md).
  const pollDianStatus = (saleId: string) => {
    const token = { cancelled: false };
    dianPollRef.current = token;
    let attempt = 0;

    const tick = async () => {
      if (token.cancelled) return;
      attempt++;

      try {
        const status = await posApi.getSaleStatus(saleId);
        if (token.cancelled) return;

        if (status.dianStatus !== "PENDING") {
          setCompletedSale((prev: any) =>
            prev && String(prev._id) === saleId ? { ...prev, ...status } : prev
          );
          setAwaitingDian(false);
          return;
        }
      } catch {
        // Hiccup de red puntual en el polling — no corta la espera, se
        // reintenta en el siguiente tick igual que si siguiera "PENDING".
      }

      if (token.cancelled) return;

      if (attempt >= DIAN_POLL_MAX_ATTEMPTS) {
        setAwaitingDian(false);
        return;
      }

      setTimeout(tick, DIAN_POLL_INTERVAL_MS);
    };

    setTimeout(tick, DIAN_POLL_INTERVAL_MS);
  };

  const processSale = async (customer?: any) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setSaleError("");
    const localTicketId = generateLocalTicketId();

    const payload = {
      items: order.map((l) => ({
        productId: l.productId,
        name: l.name,
        quantity: l.quantity,
        price: l.price,
        modifiers: l.modifiers,
        subtotal: l.subtotal,
      })),
      paymentMethod: selectedMethod,
      orderType: isDidi ? "DIDI" : "POS_COUNTER",
      customer,
      localTicketId,
    };

    try {
      // Toda venta se crea en línea ahora — valida y descuenta stock en el
      // momento (ver punto 8 de CLAUDE.md). Ya no hay fallback a cola
      // offline: si esto falla (sin conexión, stock insuficiente, etc.),
      // la venta simplemente no se registra y el cajero ve el error para
      // reintentar, en vez de quedar encolada silenciosamente.
      const sale = await posApi.createSale(payload);
      setCompletedSale(sale);
      // Arriba-derecha a propósito, distinto del `top-center` default del
      // `<ToastContainer />` (CashierLayout.tsx, ver punto 49 de CLAUDE.md)
      // que ya usan los toasts de abrir/cerrar turno — react-toastify deja
      // sobreescribir la posición por toast individual sin tocar el
      // contenedor compartido ni afectar a esos otros toasts.
      toast.success("Venta registrada correctamente", { position: "top-right" });
      // Dos disparadores DIAN distintos (ver punto 37 de backend/CLAUDE.md):
      // si el cliente pidió factura, la venta se encoló y sigue "PENDING" —
      // ahí sí hay que esperar. Si quedó "SPECIAL" por el tope/cooldown
      // diario en cambio, el backend ya intentó la emisión en línea antes de
      // responder — dianStatus ya viene resuelto (APPROVED, o cayó a
      // REGULAR), así que no hay nada que esperar.
      if (sale.category === "SPECIAL" && sale.dianStatus === "PENDING") {
        setAwaitingDian(true);
        pollDianStatus(String(sale._id));
      } else {
        dianPollRef.current.cancelled = true;
        setAwaitingDian(false);
      }
      clearOrder();
      setSelectedMethod(null);
      setCashReceived("");
      setIsDidi(false);
    } catch (err: any) {
      setSaleError(err.message || "No se pudo registrar la venta");
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div className="w-[30%] h-full flex flex-col bg-neutral-50">
      {/* Barra superior con sesión y accesos a modals flotantes */}
      <div className="p-3 border-b border-neutral-200 bg-white flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{branchName}</div>
          <div className="text-xs text-neutral-400">{cashierName}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openModal("EXPENSE")}
            title="Gasto menor de caja"
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-700"
          >
            <Banknote size={16} />
            Gasto
          </button>
          <button
            onClick={() => openModal("STOCK_LOSS")}
            title="Registrar merma de stock"
            className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-700"
          >
            <Trash2 size={16} />
            Merma
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <button
            onClick={() => {
              const next = !isDidi;
              setIsDidi(next);
              // El canal fuerza el método server-side de todos modos (ver
              // resolvePaymentMethodForChannel) — esto solo mantiene la UI
              // honesta con lo que en realidad va a quedar guardado.
              setSelectedMethod(next ? "BANCOLOMBIA" : null);
            }}
            className={`w-full flex items-center justify-between rounded-xl p-3 border-2 transition-colors ${
              isDidi ? "border-brand-600 bg-brand-50" : "border-neutral-200 bg-white"
            }`}
          >
            <span className={`text-sm font-semibold ${isDidi ? "text-brand-700" : "text-neutral-600"}`}>
              Pedido DiDi
            </span>
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDidi ? "bg-brand-600" : "bg-neutral-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDidi ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-500 mb-2">Método de pago</h3>
          <div data-tour="payment-methods" className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon;
              const active = selectedMethod === m.key;
              // Con "Pedido DiDi" activo, el método queda forzado a
              // Bancolombia (ver arriba) — Efectivo/Nequi se deshabilitan
              // en vez de ocultarse, para que quede claro por qué no se
              // pueden elegir en vez de simplemente desaparecer.
              const disabled = isDidi && m.key !== "BANCOLOMBIA";
              return (
                <button
                  key={m.key}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    setSelectedMethod(m.key);
                    if (m.key === "EFECTIVO") openModal("CASH_PAYMENT");
                  }}
                  className={`rounded-xl py-4 flex flex-col items-center gap-1 border-2 transition-colors ${
                    active ? "border-brand-600 bg-brand-50" : "border-transparent bg-white shadow-sm"
                  } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {/* Slot CUADRADO fijo compartido — un rectángulo (alto
                      distinto del ancho) distribuye el espacio sobrante de
                      `object-contain` de forma distinta en X que en Y según
                      el aspect ratio propio de cada imagen, lo que se ve
                      "descentrado" contra el texto de abajo aunque el
                      contenido esté centrado dentro de la imagen. Un slot
                      cuadrado no tiene ese problema en ningún eje. */}
                  <div className="h-9 w-9 flex items-center justify-center">
                    {Icon ? (
                      <Icon size={26} className={active ? "text-brand-600" : "text-neutral-400"} />
                    ) : (
                      <img
                        src={m.iconSrc}
                        alt={m.label}
                        className={`h-9 w-9 object-contain ${active ? "" : "opacity-60"}`}
                      />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${active ? "text-brand-700" : "text-neutral-600"}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMethod === "EFECTIVO" && (
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs text-neutral-500">Efectivo recibido</label>
              <button
                onClick={() => openModal("CASH_PAYMENT")}
                className="text-xs text-brand-600 hover:underline font-medium"
              >
                💵 Billetes y monedas
              </button>
            </div>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="w-full mt-1 text-lg font-semibold border border-neutral-200 rounded-lg p-2"
              placeholder="0"
            />
            {cashReceived && (
              <div className="mt-2 text-sm">
                Vueltas:{" "}
                <span className={change < 0 ? "text-red-500" : "text-green-600"}>
                  ${change.toLocaleString("es-CO")}
                </span>
              </div>
            )}
          </div>
        )}

        {saleError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
            {saleError}
          </div>
        )}

        {/* Última cosa que ve el cajero antes de "Cobrar" — recapitulación
            de solo lectura del pedido (ver OrderSummary.tsx). El pedido en
            sí se arma/edita en OrderPanel.tsx (columna del medio), esto no
            duplica esos controles. */}
        <OrderSummary selectedMethod={selectedMethod} isDidi={isDidi} />
      </div>

      <div className="p-4 border-t border-neutral-200 bg-white">
        <button
          disabled={
            order.length === 0 ||
            !selectedMethod ||
            processing ||
            (selectedMethod === "EFECTIVO" && Number(cashReceived) < total)
          }
          onClick={finalizeSale}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white font-bold py-4 rounded-xl text-lg"
        >
          {processing ? "Procesando..." : `Cobrar $${total.toLocaleString("es-CO")}`}
        </button>
      </div>

      {processing && !completedSale && <ProcessingSaleModal total={total} />}
      {completedSale && awaitingDian && (
        <EmittingReceipt
          total={completedSale.total}
          ticketId={String(completedSale._id).slice(-8).toUpperCase()}
          onSkip={() => {
            dianPollRef.current.cancelled = true;
            setAwaitingDian(false);
          }}
        />
      )}
      {completedSale && !awaitingDian && (
        <SaleReceipt sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
    </div>
  );
}
