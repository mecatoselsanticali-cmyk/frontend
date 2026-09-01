import { usePosStore } from "../store/posStore";
import CategoryMenu from "../components/CategoryMenu";
import OrderPanel from "../components/OrderPanel";
import PaymentPanel from "../components/PaymentPanel";
import ShiftRequiredNotice from "../components/ShiftRequiredNotice";
import ExpenseModal from "../components/modals/ExpenseModal";
import StockLossModal from "../components/modals/StockLossModal";
import CustomerModal from "../components/modals/CustomerModal";
import CashPaymentModal from "../components/modals/CashPaymentModal";
import InvoicePromptModal from "../components/modals/InvoicePromptModal";

export default function Caja() {
  const activeModal = usePosStore((s) => s.activeModal);
  const shiftId = usePosStore((s) => s.shiftId);
  const shiftChecked = usePosStore((s) => s.shiftChecked);

  // La verificación del turno (GET /api/pos/shifts/current) y la apertura
  // automática de ShiftModal viven en CashierLayout.tsx, no acá — se
  // comparten entre las 3 pestañas del cajero. Esta página solo decide
  // qué mostrar según el resultado: mientras no haya turno, ni el grid ni
  // la orden ni el panel de pago se montan (no es un overlay encima de
  // ellos, ver punto 32 de CLAUDE.md) — así el cajero puede seguir
  // cambiando de pestaña y cerrando sesión sin que nada se lo impida.
  if (shiftChecked && !shiftId) {
    return <ShiftRequiredNotice />;
  }

  return (
    <div className="h-full w-full flex overflow-hidden relative">
      <CategoryMenu />
      <OrderPanel />
      <PaymentPanel />

      {activeModal === "EXPENSE" && <ExpenseModal />}
      {activeModal === "STOCK_LOSS" && <StockLossModal />}
      {activeModal === "CUSTOMER" && <CustomerModal />}
      {activeModal === "CASH_PAYMENT" && <CashPaymentModal />}
      {activeModal === "INVOICE_PROMPT" && <InvoicePromptModal />}
    </div>
  );
}
