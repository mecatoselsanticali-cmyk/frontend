// Tope real del polling de estado DIAN tras crear una venta "SPECIAL"
// (usado por PaymentPanel.tsx para el polling en sí, y por
// EmittingReceipt.tsx para que su barra de progreso derive del mismo
// número real). Vive en su propio archivo, no exportado desde
// PaymentPanel.tsx, para que EmittingReceipt.tsx pueda importarlo sin
// crear una dependencia circular entre los dos componentes (PaymentPanel.tsx
// ya importa EmittingReceipt.tsx).
export const DIAN_POLL_INTERVAL_MS = 1000;
export const DIAN_POLL_MAX_ATTEMPTS = 15;

// Timeout real de `posApi.createSale` (ver services/posApi.ts) — más alto
// que el default de 8s del cliente axios porque una venta "SPECIAL" por
// tope/cooldown diario ahora puede intentar la emisión DIAN en línea antes
// de responder (ver punto 37 de backend/CLAUDE.md). `ProcessingSaleModal.tsx`
// lo reusa para que su barra de progreso derive del mismo número real en
// vez de uno aparte hardcodeado — mismo criterio que `EmittingReceipt.tsx`
// con el polling de arriba.
export const CREATE_SALE_TIMEOUT_MS = 20000;
