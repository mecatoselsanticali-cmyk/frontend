import { posHttp } from "./httpClient";

export const posApi = {
  getBranches: () => posHttp.get("/auth/branches").then((r) => r.data),

  login: (branchId: string, pin: string) =>
    posHttp.post("/auth/login", { branchId, pin }).then((r) => r.data),

  logout: () => posHttp.post("/auth/logout").then((r) => r.data),

  /** Verifica la cookie httpOnly y devuelve los datos de la sesión actual. */
  me: () => posHttp.get("/auth/me").then((r) => r.data),

  getCatalog: () => posHttp.get("/catalog").then((r) => r.data),

  createSale: (payload: any) => posHttp.post("/sales", payload).then((r) => r.data),

  syncBatch: (sales: any[]) =>
    posHttp.post("/sales/sync-batch", { sales }).then((r) => r.data),

  getDailyTotal: () => posHttp.get("/sales/daily-total").then((r) => r.data),

  getSalesHistory: () => posHttp.get("/sales/history").then((r) => r.data),

  // Tabla de stock actual de la sede (SKU/nombre/precio/cantidad/valor
  // total), para la verificación de stock al abrir/cerrar turno.
  getStockSnapshot: () => posHttp.get("/stock-snapshot").then((r) => r.data),

  // Id del turno OPEN del cajero (o null) — fuente de verdad server-side,
  // usada por Caja.tsx para bloquear la pantalla hasta que abra un turno.
  getCurrentShift: (): Promise<{ shiftId: string | null }> =>
    posHttp.get("/shifts/current").then((r) => r.data),

  // Resumen de ventas/gastos del turno abierto (base, ventas por método de
  // pago, gastos de caja menor, efectivo/Nequi esperado) — se muestra en
  // el modal de cierre ANTES de que el cajero declare lo contado, a
  // pedido del negocio (ya no es un arqueo ciego, ver cashClosureController.ts).
  getShiftSummary: (shiftId: string) => posHttp.get(`/shifts/${shiftId}/summary`).then((r) => r.data),

  openShift: (data: {
    initialCash: number;
    initialNequi: number;
    stockConfirmed: boolean;
    stockAnnotation?: string;
  }) => posHttp.post("/shifts/open", data).then((r) => r.data),

  closeShift: (
    shiftId: string,
    data: {
      declaredCash: number;
      declaredNequi: number;
      reportType: "X" | "Z";
      stockConfirmed: boolean;
      stockAnnotation?: string;
    }
  ) => posHttp.post(`/shifts/${shiftId}/close`, data).then((r) => r.data),

  registerExpense: (concept: string, amount: number) =>
    posHttp.post("/expenses", { concept, amount }).then((r) => r.data),

  // Compras del día — producto + cantidad, ligadas a inventario (ya no es
  // el flujo informal con foto de recibo; ver StockModal.tsx del panel
  // admin para el patrón que esto replica, restringido a la sede propia).
  getPurchases: () => posHttp.get("/purchases").then((r) => r.data),

  // Catálogo completo de productos activos para el selector de compra, SIN
  // filtrar por stock (a diferencia de getCatalog) — el caso típico es
  // reabastecer algo que está en 0.
  getProductsForPurchase: () => posHttp.get("/products").then((r) => r.data),

  createPurchase: (data: {
    productId: string;
    supplierName: string;
    concept?: string;
    amount: number;
    quantity: number;
  }) => posHttp.post("/purchases", data).then((r) => r.data),
};
