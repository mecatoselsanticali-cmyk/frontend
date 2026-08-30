import { usePosStore } from "../../store/posStore";

/**
 * Se pregunta antes de cobrar CUALQUIER venta que no supere el tope de
 * consumidor final (si lo supera, la captura de datos ya es obligatoria —
 * ver REQ-10 en CustomerModal.tsx — y este paso se salta, no tiene sentido
 * preguntar algo que ya es forzoso). "Sí" abre CUSTOMER para capturar los
 * datos del comprador (mismo modal que usa el flujo obligatorio, ver punto
 * de CLAUDE.md sobre Factura Electrónica Nominal voluntaria); "No" avisa a
 * PaymentPanel vía CustomEvent para que cobre de una vez sin datos de
 * cliente — mismo patrón de comunicación modal→PaymentPanel que
 * `mecatos:customer-captured`/`mecatos:cash-received` (ver punto 9 de
 * CLAUDE.md: estos modals se montan en Caja.tsx, no pueden recibir un
 * callback por props).
 */
export default function InvoicePromptModal() {
  const closeModal = usePosStore((s) => s.closeModal);
  const openModal = usePosStore((s) => s.openModal);

  const answerNo = () => {
    closeModal();
    window.dispatchEvent(new CustomEvent("mecatos:invoice-declined"));
  };

  const answerYes = () => {
    openModal("CUSTOMER");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 !m-0">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-xl text-center">
        <h3 className="text-lg font-bold mb-1">¿Factura electrónica?</h3>
        <p className="text-sm text-neutral-500 mb-5">
          ¿El cliente desea recibir factura electrónica de esta venta?
        </p>
        <div className="flex gap-2">
          <button
            onClick={answerNo}
            className="flex-1 bg-neutral-100 rounded-lg py-3 text-sm font-medium"
          >
            No, gracias
          </button>
          <button
            onClick={answerYes}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-3 text-sm font-medium"
          >
            Sí, quiero factura
          </button>
        </div>
      </div>
    </div>
  );
}
