import { adminHttp } from "./httpClient";

export const adminApi = {
  login: (email: string, password: string) =>
    adminHttp.post("/auth/login", { email, password }).then((r) => r.data),

  logout: () => adminHttp.post("/auth/logout").then((r) => r.data),

  /** Verifica la cookie httpOnly y devuelve el perfil del admin autenticado. */
  me: () => adminHttp.get("/auth/me").then((r) => r.data),

  /**
   * Solo ADMIN/MANAGER (tienen correo) — un cajero nunca llega a este
   * flujo. Timeout más largo que el default de `adminHttp` (8s, ver
   * httpClient.ts) porque este endpoint espera el envío real de un correo
   * SMTP (DNS + TLS + auth + entrega) antes de responder — 8s alcanza
   * para una consulta a la base normal, pero es ajustado para un
   * round-trip SMTP, sobre todo si Render tuvo que "despertar" el
   * servicio de un cold start (plan free) justo antes de esta petición.
   */
  forgotPassword: (email: string) =>
    adminHttp.post("/auth/forgot-password", { email }, { timeout: 30000 }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    adminHttp.post("/auth/reset-password", { token, password }).then((r) => r.data),

  getDashboardKpis: (branchId?: string) =>
    adminHttp
      .get("/dashboard/kpis", { params: branchId ? { branchId } : undefined })
      .then((r) => r.data),
  getDashboardMetrics: (params?: { branchId?: string; from?: string; to?: string }) =>
    adminHttp.get("/dashboard/metrics", { params }).then((r) => r.data),

  listBranches: (params?: {
    includeInactive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/branches", { params }).then((r) => r.data),
  createBranch: (data: any) => adminHttp.post("/branches", data).then((r) => r.data),
  updateBranch: (id: string, data: any) =>
    adminHttp.put(`/branches/${id}`, data).then((r) => r.data),

  listProducts: (params?: {
    category?: string;
    search?: string;
    includeInactive?: boolean;
    branchId?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/products", { params }).then((r) => r.data),
  createProduct: (data: any) => adminHttp.post("/products", data).then((r) => r.data),
  updateProduct: (id: string, data: any) =>
    adminHttp.put(`/products/${id}`, data).then((r) => r.data),
  deleteProduct: (id: string) => adminHttp.delete(`/products/${id}`).then((r) => r.data),
  getProductStock: (id: string) =>
    adminHttp.get(`/products/${id}/stock`).then((r) => r.data),
  addProductStock: (id: string, allocations: { branchId: string; quantity: number }[]) =>
    adminHttp.post(`/products/${id}/stock`, { allocations }).then((r) => r.data),

  /**
   * Sube la foto de un producto. axios detecta que `formData` es una
   * instancia de FormData y arma el `Content-Type: multipart/form-data;
   * boundary=...` correcto por su cuenta — no lo fijes manualmente.
   */
  uploadProductImage: (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append("image", file);
    return adminHttp.post("/uploads/product-image", formData).then((r) => r.data);
  },

  listUsers: (params?: {
    branchId?: string;
    includeInactive?: boolean;
    role?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/users", { params }).then((r) => r.data),
  createUser: (data: any) => adminHttp.post("/users", data).then((r) => r.data),
  updateUser: (id: string, data: any) => adminHttp.put(`/users/${id}`, data).then((r) => r.data),
  listSales: (params?: {
    branchId?: string;
    dianStatus?: string;
    orderType?: string;
    category?: string;
    paymentMethod?: string;
    cashierId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/sales", { params }).then((r) => r.data),
  listSaleUsers: (branchId?: string) =>
    adminHttp.get("/sales/registrants", { params: { branchId } }).then((r) => r.data),
  createSale: (data: {
    branchId: string;
    items: { productId: string; quantity: number }[];
    paymentMethod: string;
    customer?: { name?: string; document?: string; email?: string };
  }) => adminHttp.post("/sales", data).then((r) => r.data),
  updateSale: (
    id: string,
    data: {
      paymentMethod?: string;
      orderType?: string;
      customer?: { name?: string; document?: string; email?: string };
      category?: "REGULAR" | "SPECIAL";
    }
  ) => adminHttp.put(`/sales/${id}`, data).then((r) => r.data),
  cancelSale: (id: string) => adminHttp.post(`/sales/${id}/cancel`).then((r) => r.data),
  confirmSalePayment: (id: string) =>
    adminHttp.patch(`/sales/${id}/confirm-payment`).then((r) => r.data),

  listPayables: (params?: Record<string, string>) =>
    adminHttp.get("/accounts-payable", { params }).then((r) => r.data),
  createPayable: (data: any) =>
    adminHttp.post("/accounts-payable", data).then((r) => r.data),

  listReceivables: (params?: Record<string, string>) =>
    adminHttp.get("/accounts-receivable", { params }).then((r) => r.data),
  createReceivable: (data: any) =>
    adminHttp.post("/accounts-receivable", data).then((r) => r.data),

  listExpenses: (params?: {
    branchId?: string;
    category?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/expenses", { params }).then((r) => r.data),

  listPurchases: (params?: {
    branchId?: string;
    from?: string;
    to?: string;
    productId?: string;
    registeredBy?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/purchases", { params }).then((r) => r.data),
  listPurchaseProducts: (branchId?: string) =>
    adminHttp.get("/purchases/products", { params: { branchId } }).then((r) => r.data),
  listPurchaseUsers: (branchId?: string) =>
    adminHttp.get("/purchases/registrants", { params: { branchId } }).then((r) => r.data),
  createPurchase: (data: {
    productId: string;
    supplierName: string;
    concept?: string;
    amount: number;
    allocations: { branchId: string; quantity: number }[];
  }) => adminHttp.post("/purchases", data).then((r) => r.data),
  updatePurchase: (
    id: string,
    data: { supplierName?: string; concept?: string; amount?: number; quantity?: number }
  ) => adminHttp.put(`/purchases/${id}`, data).then((r) => r.data),
  deletePurchase: (id: string) => adminHttp.delete(`/purchases/${id}`).then((r) => r.data),
  createExpense: (data: any) =>
    adminHttp.post("/expenses", data).then((r) => r.data),
  updateExpense: (
    id: string,
    data: { category?: string; concept?: string; amount?: number }
  ) => adminHttp.put(`/expenses/${id}`, data).then((r) => r.data),
  deleteExpense: (id: string) => adminHttp.delete(`/expenses/${id}`).then((r) => r.data),

  listCashClosures: (params?: {
    branchId?: string;
    from?: string;
    to?: string;
    cashierId?: string;
    page?: number;
    pageSize?: number;
  }) => adminHttp.get("/cash-closures", { params }).then((r) => r.data),
  listCashiersForClosures: (branchId?: string) =>
    adminHttp.get("/cash-closures/cashiers", { params: { branchId } }).then((r) => r.data),
  // Detalle de un turno para el botón "Ver" de FinanzasCaja.tsx — apertura/
  // cierre reales, verificación de inventario (con snapshot completo) y
  // ventas por método de pago, ver punto 51 de admin-frontend/CLAUDE.md.
  getCashClosureDetail: (id: string) => adminHttp.get(`/cash-closures/${id}/detail`).then((r) => r.data),
  createCashClosure: (data: any) => adminHttp.post("/cash-closures", data).then((r) => r.data),
  updateCashClosure: (id: string, data: any) =>
    adminHttp.put(`/cash-closures/${id}`, data).then((r) => r.data),
  deleteCashClosure: (id: string) => adminHttp.delete(`/cash-closures/${id}`).then((r) => r.data),

  /**
   * Descarga un reporte financiero generado por el backend (Excel o PDF) —
   * a diferencia del resto de la API, esto no devuelve JSON sino un
   * archivo binario, así que pide `responseType: "blob"` en vez de dejar
   * que el interceptor normal parsee la respuesta.
   */
  exportReport: (params: {
    format: "xlsx" | "pdf";
    branchId?: string;
    from?: string;
    to?: string;
  }): Promise<Blob> =>
    adminHttp.get("/reports/export", { params, responseType: "blob" }).then((r) => r.data),
};
