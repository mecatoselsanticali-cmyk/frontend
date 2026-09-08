import type { DriveStep } from "driver.js";

// Pasos del tour de onboarding para ADMIN/MANAGER, disparado una sola vez
// desde Dashboard.tsx (ver el `useEffect` ahí) mientras `hasCompletedOnboarding`
// sea `false`. Los 4 elementos objetivo viven en Sidebar.tsx/Topbar.tsx (el
// shell de Layout.tsx que envuelve a Dashboard, no en Dashboard.tsx en sí),
// pero ya están montados en el DOM para cuando este efecto corre porque
// Dashboard es hijo de Layout, nunca su hermano.
//
// Mismos 4 pasos para ADMIN y MANAGER — ninguno de los `data-tour` que se
// usan acá (branch-selector, inventory-link, logs-link, closures-link)
// corresponde a un link restringido por rol (ver Sidebar.tsx: solo
// "Sedes"/"Personal" llevan `roles: ["ADMIN"]`), así que no hace falta
// una lista de pasos distinta por rol.
export const adminTourSteps: DriveStep[] = [
  {
    element: '[data-tour="branch-selector"]',
    popover: {
      title: "Selector de sede",
      description:
        "Filtra todo el panel (dashboard, inventario, ventas, compras, etc.) por una sede específica. Como gerente de sede, este campo queda fijo en la tuya.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="inventory-link"]',
    popover: {
      title: "Inventario",
      description:
        "Gestiona el stock de cada producto por sede y detecta de un vistazo qué está por agotarse.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="logs-link"]',
    popover: {
      title: "Ventas",
      description:
        "Historial de movimientos y transacciones de venta — filtra por sede, fecha, usuario, método de pago o estado DIAN.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="closures-link"]',
    popover: {
      title: "Finanzas",
      description:
        "Cierres de caja por turno (arqueos) y reportes exportables. La conciliación de pagos pendientes de DiDi/Rappi se confirma desde Ventas, con el botón \"Confirmar Pago\".",
      side: "right",
      align: "start",
    },
  },
];
