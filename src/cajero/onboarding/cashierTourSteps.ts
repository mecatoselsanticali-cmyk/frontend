import type { DriveStep } from "driver.js";

// Pasos del tour de onboarding para CASHIER, disparado desde Caja.tsx (ver
// el `useEffect` ahí) mientras `hasCompletedOnboarding` sea `false` — pero
// SOLO cuando la pestaña ya está mostrando el grid/orden/pago reales, no
// mientras muestra `ShiftRequiredNotice` (ver punto 31 de CLAUDE.md): los
// 5 elementos objetivo de acá abajo no existen en el DOM sin un turno
// abierto, "shift-close" incluido (el botón "Finalizar turno" del header
// de CashierLayout.tsx solo se renderiza con `{shiftId && (...)}`).
//
// Nota: el pedido original habla de un método de pago "DIDI", pero en el
// modelo real (ver PaymentPanel.tsx / punto 34 de backend/CLAUDE.md) DiDi
// y Rappi comparten un único valor de `paymentMethod`, `DELIVERY_APP`
// ("App Delivery" en el selector) — no existe un método `"DIDI"` aparte.
export const cashierTourSteps: DriveStep[] = [
  {
    element: '[data-tour="categories"]',
    popover: {
      title: "Categorías",
      description: "Cambia de categoría para filtrar el grid de productos de la derecha.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="product-grid"]',
    popover: {
      title: "Productos",
      description:
        "Toca un producto para agregarlo a la orden. Un producto ya agregado se deshabilita aquí — ajusta la cantidad desde el panel de la orden.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="cart-summary"]',
    popover: {
      title: "Orden actual",
      description:
        "Los productos agregados y el total a cobrar. Toca la cantidad de una línea para editarla directamente.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="payment-methods"]',
    popover: {
      title: "Método de pago",
      description: "Efectivo, Nequi, Datáfono o App Delivery (DiDi/Rappi) — elige uno para habilitar \"Cobrar\".",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="shift-close"]',
    popover: {
      title: "Finalizar turno",
      description:
        "Al terminar tu jornada, usa este botón para cerrar la caja — vas a contar el efectivo/Nequi y verificar el stock antes de confirmar.",
      side: "bottom",
      align: "center",
    },
  },
];
