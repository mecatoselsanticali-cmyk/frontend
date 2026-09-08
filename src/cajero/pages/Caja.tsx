import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { usePosStore } from "../store/posStore";
import { posApi } from "../services/posApi";
import { cashierTourSteps } from "../onboarding/cashierTourSteps";
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
  const hasCompletedOnboarding = usePosStore((s) => s.hasCompletedOnboarding);
  const completeOnboarding = usePosStore((s) => s.completeOnboarding);

  // Tour de onboarding del cajero — a diferencia del de ADMIN/MANAGER
  // (que arranca apenas monta Dashboard.tsx), acá hay que esperar a que
  // haya un turno abierto: sin turno, esta página ni siquiera monta el
  // grid/orden/pago reales (ver el `return` de abajo, punto 31 de
  // CLAUDE.md) — los 5 `data-tour` de cashierTourSteps.ts (incluido
  // "shift-close", el botón del header de CashierLayout.tsx, que solo se
  // renderiza con `shiftId` presente) no existirían todavía en el DOM.
  // Lee `hasCompletedOnboarding`/`completeOnboarding` de `usePosStore`, no
  // de `useAuthSession()` — Caja.tsx vive dentro de `src/cajero/` y esa
  // frontera solo tiene dos excepciones documentadas (CashierLayout.tsx/
  // RequireCashierAuth.tsx, ver punto 12 de CLAUDE.md), que ya se
  // encargan de hidratar este mismo dato en el store.
  useEffect(() => {
    if (hasCompletedOnboarding) return;
    if (!(shiftChecked && shiftId)) return;

    // Mismo criterio que el tour de ADMIN (ver Dashboard.tsx): distingue
    // un destroy() por acción del usuario de uno disparado por el
    // cleanup de este efecto (cambio de pestaña, o el doble-montaje de
    // React.StrictMode en dev), para no marcar el onboarding como
    // completado por un destroy "falso".
    let dismissedByCleanup = false;

    const tourDriver = driver({
      showProgress: true,
      steps: cashierTourSteps,
      onPopoverRender: (popover) => {
        const skipBtn = document.createElement("button");
        skipBtn.type = "button";
        skipBtn.textContent = "Omitir";
        skipBtn.className = "driver-popover-footer-btn";
        skipBtn.addEventListener("click", () => tourDriver.destroy());
        popover.footerButtons.prepend(skipBtn);
      },
      onDestroyed: () => {
        if (dismissedByCleanup) return;
        completeOnboarding();
        posApi.completeOnboarding().catch(() => {
          // best-effort — si falla, el peor caso es que el tour vuelva a
          // aparecer en el próximo login, no es una operación crítica
        });
      },
    });

    tourDriver.drive();

    return () => {
      dismissedByCleanup = true;
      tourDriver.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompletedOnboarding, shiftChecked, shiftId]);

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
