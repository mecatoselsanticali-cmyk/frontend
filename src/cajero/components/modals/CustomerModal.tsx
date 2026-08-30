import { useState } from "react";
import { usePosStore } from "../../store/posStore";

/**
 * Captura los datos del comprador para Factura Electrónica Nominal, por
 * dos caminos posibles: (1) REQ-10 — la venta supera el tope de
 * consumidor final, así que es obligatorio (PaymentPanel abre este modal
 * directo, sin preguntar); o (2) el cliente lo pide voluntariamente aunque
 * la venta esté por debajo del tope (InvoicePromptModal → "Sí" abre este
 * mismo modal). En ambos casos el resultado es idéntico del lado del
 * backend: basta con que `customer.document` llegue poblado para que
 * `posController.createSale` marque la venta como `FACTURA_NOMINAL`. Al
 * confirmar, dispara un evento que PaymentPanel escucha para completar la
 * venta.
 */
export default function CustomerModal() {
  const closeModal = usePosStore((s) => s.closeModal);
  const [name, setName] = useState("");
  const [document, setDocumentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const confirm = () => {
    if (!name || !document) {
      setError("Nombre y documento son obligatorios para la factura nominal");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("mecatos:customer-captured", { detail: { name, document, email } })
    );
    closeModal();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 !m-0">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-1">Datos del comprador</h3>
        <p className="text-xs text-neutral-500 mb-4">
          Requeridos para emitir tu Factura Electrónica de Venta
        </p>

        <label className="text-xs text-neutral-500">Nombre / Razón social</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 mb-3 border border-neutral-200 rounded-lg p-2"
        />

        <label className="text-xs text-neutral-500">Cédula / NIT</label>
        <input
          value={document}
          onChange={(e) => setDocumentNumber(e.target.value)}
          className="w-full mt-1 mb-3 border border-neutral-200 rounded-lg p-2"
        />

        <label className="text-xs text-neutral-500">Correo electrónico</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 mb-4 border border-neutral-200 rounded-lg p-2"
        />

        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={closeModal}
            className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium"
          >
            Confirmar y cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
