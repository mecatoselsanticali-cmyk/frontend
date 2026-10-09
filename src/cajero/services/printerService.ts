// Copia intencional de ../../services/printerService.ts (ver punto 12 de
// CLAUDE.md: src/cajero/ no importa nada de fuera de sí mismo). Cliente
// del print-server local (ver print-server/ en la raíz del repo y
// docs/THERMAL_PRINTER_INTEGRATION.md). A propósito usa `fetch`, no
// cajero/services/httpClient.ts — el print-server es un proceso local de
// la terminal física del cajero, no la API en la nube, así que no
// necesita cookies/credenciales ni pasar por el interceptor de errores.

export interface PrintReceiptPayload {
  branch: string;
  branchAddress?: string;
  branchPhone?: string;
  invoiceId: string;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  subtotal: number;
  total: number;
  cashier: string;
  paymentMethod: string;
  dianProvider?: "MOCK" | "SIIGO" | "FACTUS" | "LEGACY";
  // Campos del bloque DIAN real (CUFE/QR/pie legal) — ver punto 34 de
  // backend/CLAUDE.md (rediseño de recibo). `showDianBlock` se calcula UNA
  // sola vez en SaleReceipt.tsx (dianStatus === "APPROVED" && cufe) para
  // que print-server no tenga que duplicar esa condición.
  showDianBlock?: boolean;
  cufe?: string;
  qrCodeUrl?: string;
  dianInvoiceNumber?: string;
  resolutionNumber?: string;
  resolutionPrefix?: string;
  resolutionFrom?: number;
  resolutionTo?: number;
}

// Desde una página HTTPS (producción), `http://localhost:4001/...` es Mixed
// Content y el navegador la bloquea en silencio — el frontend entonces cae a
// `window.print()` y parece que la térmica está ocupada. El print-server solo
// está bindado a 127.0.0.1, así que desde HTTPS podemos ir directamente a
// `http://127.0.0.1:4001/...` sin preocuparnos por CORS (es loopback). En dev
// (HTTP) seguimos usando `localhost` igual que antes.
function printServerUrl(path: string): string {
  if (typeof window !== "undefined" && window.location?.protocol === "https:") {
    return `http://127.0.0.1:4001${path}`;
  }
  return `http://localhost:4001${path}`;
}

const PRINT_SERVER_URL = printServerUrl("/print-receipt");
const PREVIEW_SERVER_URL = printServerUrl("/preview-receipt");

/**
 * Intenta imprimir el recibo en la impresora térmica local. Si el
 * print-server no está corriendo/instalado en esta máquina (lo normal en
 * cualquier terminal sin impresora física, o mientras se desarrolla), cae
 * de vuelta a `window.print()` en silencio — nunca lanza, siempre resuelve.
 */
export const printThermalReceipt = async (data: PrintReceiptPayload): Promise<boolean> => {
  try {
    const response = await fetch(PRINT_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Local printer server unreachable");
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.warn("Silent print failed, falling back to browser print dialog:", error);
    window.print();
    return false;
  }
};

/**
 * Abre en una pestaña nueva una vista previa HTML de cómo quedaría el
 * ticket térmico (mismo logo, mismos anchos de columna que el ESC/POS
 * real) — sirve para revisar el formato sin tener la impresora física
 * conectada. Requiere que el print-server local esté corriendo (por eso
 * NO cae a ningún fallback silencioso como `printThermalReceipt`: si no
 * está disponible, se lanza el error para que quien llame lo muestre).
 *
 * Antes, cualquier `!response.ok` lanzaba el mensaje genérico "Print-server
 * local no disponible para vista previa" — indistinguible de un fallo de
 * conexión real, cuando en realidad podía ser un 400 con un error de
 * validación concreto (`{"error":"item con campos numéricos inválidos"}`).
 * El cajero veía el mensaje genérico y asumía que la térmica estaba
 * desconectada. Ahora se intenta leer el body JSON y propagar el `error`
 * real del servidor; solo si no se puede leer (red caída, CORS bloqueó la
 * respuesta) se cae al mensaje genérico.
 */
export const previewThermalReceipt = async (data: PrintReceiptPayload): Promise<void> => {
  const response = await fetch(PREVIEW_SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let serverMessage: string | undefined;
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") serverMessage = body.error;
    } catch {
      // body no es JSON o no se pudo parsear — probablemente CORS o red caída
    }
    throw new Error(
      serverMessage
        ? `Print-server rechazó el recibo: ${serverMessage}`
        : "Print-server local no disponible para vista previa"
    );
  }

  const html = await response.text();
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    throw new Error("El navegador bloqueó la ventana de vista previa (pop-up)");
  }
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
};
