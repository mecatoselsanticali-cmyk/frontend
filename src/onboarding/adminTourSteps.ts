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
const baseSteps: DriveStep[] = [
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

// Paso extra, SOLO en celular (ver `getAdminTourSteps` abajo) — los 3
// últimos pasos de `baseSteps` apuntan a links de `Sidebar.tsx`, que en
// `< md` viven detrás de un drawer off-canvas cerrado por default (ver
// punto 36 de CLAUDE.md, `isOpen`/`-translate-x-full` en Sidebar.tsx) —
// sin este paso, driver.js intentaba resaltar "Inventario" mientras el
// link seguía fuera de la pantalla, a la izquierda del viewport.
const menuButtonStep: DriveStep = {
  element: '[data-tour="menu-button"]',
  popover: {
    title: "Menú",
    description:
      "Desde el celular, el menú de navegación (Sedes, Inventario, Ventas, Finanzas...) vive detrás de este botón. Tócalo para abrirlo — el tour sigue apenas se abra.",
    side: "bottom",
    align: "start",
    // `onNextClick` REEMPLAZA el avance normal de driver.js (hay que
    // llamar `moveNext()` a mano) — simula el click real del botón de
    // hamburguesa (el mismo nodo del DOM que ya dispara `onMenuClick` en
    // Topbar.tsx → `setSidebarOpen(true)` en Layout.tsx), en vez de
    // inventar un mecanismo aparte para abrir el drawer desde acá. El
    // `setTimeout` espera a que termine la transición CSS del drawer
    // (`duration-200`, Sidebar.tsx) antes de dejar que driver.js calcule
    // la posición del siguiente paso — sin esperar, mide la posición del
    // link de Inventario a mitad de la animación, con el drawer todavía
    // deslizándose desde fuera de la pantalla.
    onNextClick: (_element, _step, opts) => {
      (document.querySelector('[data-tour="menu-button"]') as HTMLElement | null)?.click();
      window.setTimeout(() => opts.driver.moveNext(), 250);
    },
  },
};

export function getAdminTourSteps(isMobile: boolean): DriveStep[] {
  if (!isMobile) return baseSteps;
  const [branchSelectorStep, ...sidebarLinkSteps] = baseSteps;
  return [branchSelectorStep, menuButtonStep, ...sidebarLinkSteps];
}
