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
  tax: number;
  total: number;
  cashier: string;
  paymentMethod: string;
}

const PRINT_SERVER_URL = "http://localhost:4001/print-receipt";
const PREVIEW_SERVER_URL = "http://localhost:4001/preview-receipt";

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
 */
export const previewThermalReceipt = async (data: PrintReceiptPayload): Promise<void> => {
  const response = await fetch(PREVIEW_SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Print-server local no disponible para vista previa");
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
