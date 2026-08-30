import { useState } from "react";
import { Printer, Eye } from "lucide-react";
import { printThermalReceipt, previewThermalReceipt, type PrintReceiptPayload } from "../services/printerService";
import { formatDateTime } from "../utils/timezone";

interface SaleReceiptProps {
  sale: any; // Sale con branchId/cashierId poblados (ver listCashierSales)
  onClose: () => void;
}

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  NEQUI: "Nequi",
  CARD: "Tarjeta",
  DELIVERY_APP: "App de domicilios",
};

export const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/**
 * Recibo imprimible de una venta, para la pestaña Facturas del cajero — copia
 * intencional de admin-frontend/src/components/SaleReceipt.tsx (ver punto 12
 * de CLAUDE.md: src/cajero/ no importa nada de fuera de sí mismo). Depende
 * de que `sale.branchId`/`sale.cashierId` vengan poblados ({name,address,
 * phone} / {name}), no como ObjectId — ver listCashierSales en posController.
 */
export default function SaleReceipt({ sale, onClose }: SaleReceiptProps) {
  const branch = sale.branchId;
  const cashierName = sale.cashierId?.name;
  const [printing, setPrinting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const buildReceiptPayload = (): PrintReceiptPayload => ({
    branch: branch?.name || "",
    branchAddress: branch?.address,
    branchPhone: branch?.phone,
    invoiceId: String(sale._id).slice(-8).toUpperCase(),
    items: sale.items.map((it: any) => ({
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      subtotal: it.subtotal,
    })),
    subtotal: sale.subtotal,
    tax: sale.tax,
    total: sale.total,
    cashier: cashierName || "—",
    paymentMethod: paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod,
  });

  // Intenta la impresora térmica local primero (print-server, ver
  // docs/THERMAL_PRINTER_INTEGRATION.md); si no está disponible en esta
  // máquina, printThermalReceipt ya cae de vuelta a window.print() por su
  // cuenta. Sin `disabled` permanente tras el primer click: el cajero
  // puede pedir copias adicionales sin cerrar el modal.
  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printThermalReceipt(buildReceiptPayload());
    } finally {
      setPrinting(false);
    }
  };

  // A diferencia de handlePrint, esto NO tiene fallback silencioso — si el
  // print-server local no está corriendo, avisa con un alert en vez de
  // fallar en silencio, porque el único propósito de este botón es
  // justamente ver el formato del ticket térmico sin tener la impresora
  // física conectada (ver docs/THERMAL_PRINTER_INTEGRATION.md).
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      await previewThermalReceipt(buildReceiptPayload());
    } catch (error: any) {
      alert(error?.message || "No se pudo generar la vista previa");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #sale-receipt, #sale-receipt * { visibility: visible; }
          #sale-receipt { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div id="sale-receipt" className="p-8">
          <div className="flex flex-col items-center text-center border-b border-neutral-200 pb-4 mb-4">
            <img
              src="/img/logo-santi-trimmed.png"
              alt="Mecatos el Santi"
              className="w-24 mb-2 select-none"
              draggable={false}
            />
            <h2 className="font-bold text-lg">Mecatos el Santi</h2>
            <p className="text-xs text-neutral-500">{branch?.name}</p>
            <p className="text-xs text-neutral-500">{branch?.address}</p>
            <p className="text-xs text-neutral-500">{branch?.phone}</p>
          </div>

          <div className="text-xs text-neutral-500 mb-4 space-y-0.5">
            <div className="flex justify-between gap-3">
              <span>Ticket: {String(sale._id).slice(-8).toUpperCase()}</span>
              <span>{formatDateTime(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Atendido por: {cashierName || "—"}</span>
              <span>{paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod}</span>
            </div>
          </div>

          {sale.status === "CANCELLED" && (
            <div className="text-center text-xs font-medium text-red-600 bg-red-50 rounded-lg py-1.5 mb-4">
              Venta cancelada
            </div>
          )}

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-xs text-neutral-400 border-b border-neutral-200">
                <th className="text-left font-medium py-1">Producto</th>
                <th className="text-right font-medium py-1">Cant.</th>
                <th className="text-right font-medium py-1">Precio</th>
                <th className="text-right font-medium py-1">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-neutral-50">
                  <td className="py-1.5">{it.name}</td>
                  <td className="py-1.5 text-right">{it.quantity}</td>
                  <td className="py-1.5 text-right">{money(it.price)}</td>
                  <td className="py-1.5 text-right">{money(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span>{money(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Impuesto (INC)</span>
              <span>{money(sale.tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-neutral-200 pt-1">
              <span>Total</span>
              <span>{money(sale.total)}</span>
            </div>
          </div>

          {sale.customer?.document && (
            <div className="text-xs text-neutral-500 mb-4">
              <p>Cliente: {sale.customer.name || "—"}</p>
              <p>Documento: {sale.customer.document}</p>
            </div>
          )}

          <div className="text-center text-xs text-neutral-400 border-t border-neutral-200 pt-3">
            <p>Factura electrónica en proceso de validación DIAN.</p>
            <p className="mt-1">¡Gracias por tu compra!</p>
          </div>
        </div>

        <div className="no-print flex gap-2 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={handlePreview}
            disabled={previewing}
            title="Ver cómo quedaría el ticket térmico sin necesidad de tener la impresora conectada"
            className="flex-1 flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            <Eye size={16} />
            {previewing ? "Generando..." : "Vista previa"}
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            <Printer size={16} />
            {printing ? "Imprimiendo..." : "Imprimir recibo"}
          </button>
        </div>
      </div>
    </div>
  );
}
