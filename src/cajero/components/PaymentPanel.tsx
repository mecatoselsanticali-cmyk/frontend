import { useEffect, useRef, useState } from "react";
import { Banknote, Trash2, Coins, Smartphone, CreditCard, Bike, type LucideIcon } from "lucide-react";
import { usePosStore } from "../store/posStore";
import { generateLocalTicketId } from "../db/offlineDb";
import { posApi } from "../services/posApi";
import SaleReceipt from "./SaleReceipt";

type PaymentMethod = "CASH" | "NEQUI" | "CARD" | "DELIVERY_APP";

const TOPE_CONSUMIDOR_FINAL = 509000;

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { key: "CASH", label: "Efectivo", icon: Coins },
  { key: "NEQUI", label: "Nequi", icon: Smartphone },
  { key: "CARD", label: "Datáfono", icon: CreditCard },
  { key: "DELIVERY_APP", label: "App Delivery", icon: Bike },
];

export default function PaymentPanel() {
  const order = usePosStore((s) => s.order);
  const clearOrder = usePosStore((s) => s.clearOrder);
  const orderTotal = usePosStore((s) => s.orderTotal());
  const openModal = usePosStore((s) => s.openModal);
  const branchName = usePosStore((s) => s.branchName);
  const cashierName = usePosStore((s) => s.cashierName);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [saleError, setSaleError] = useState("");
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
      orderType: "POS_COUNTER",
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
      clearOrder();
      setSelectedMethod(null);
      setCashReceived("");
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
          <h3 className="text-sm font-semibold text-neutral-500 mb-2">Método de pago</h3>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = m.icon;
              const active = selectedMethod === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setSelectedMethod(m.key);
                    if (m.key === "CASH") openModal("CASH_PAYMENT");
                  }}
                  className={`rounded-xl py-4 flex flex-col items-center gap-1 border-2 transition-colors ${
                    active ? "border-brand-600 bg-brand-50" : "border-transparent bg-white shadow-sm"
                  }`}
                >
                  <Icon size={22} className={active ? "text-brand-600" : "text-neutral-400"} />
                  <span className={`text-xs font-medium ${active ? "text-brand-700" : "text-neutral-600"}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMethod === "CASH" && (
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
      </div>

      <div className="p-4 border-t border-neutral-200 bg-white">
        <button
          disabled={
            order.length === 0 ||
            !selectedMethod ||
            processing ||
            (selectedMethod === "CASH" && Number(cashReceived) < total)
          }
          onClick={finalizeSale}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white font-bold py-4 rounded-xl text-lg"
        >
          {processing ? "Procesando..." : `Cobrar $${total.toLocaleString("es-CO")}`}
        </button>
      </div>

      {completedSale && (
        <SaleReceipt sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
    </div>
  );
}
