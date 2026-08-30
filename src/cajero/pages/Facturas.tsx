import { useEffect, useState } from "react";
import { posApi } from "../services/posApi";
import { usePosStore } from "../store/posStore";
import SaleReceipt from "../components/SaleReceipt";
import ShiftRequiredNotice from "../components/ShiftRequiredNotice";
import { formatTime } from "../utils/timezone";

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-50 text-amber-600" },
  SENT: { label: "Enviada", className: "bg-blue-50 text-blue-600" },
  APPROVED: { label: "Emitida", className: "bg-green-50 text-green-600" },
  REJECTED: { label: "Rechazada", className: "bg-red-50 text-red-600" },
};

/**
 * Muestra las facturas creadas por este cajero durante su TURNO actual
 * (desde que abrió el último arqueo, sin importar si ya lo cerró — ver
 * `getCashierShiftStart` en el backend). Antes filtraba por día calendario
 * y, antes de eso, por `posSession.loginAt` — ninguno de los dos servía
 * para turnos que cruzan medianoche (empiezan un día, terminan al
 * siguiente). Ver `listCashierSales` en posController.ts.
 */
export default function Facturas() {
  const shiftId = usePosStore((s) => s.shiftId);
  const shiftChecked = usePosStore((s) => s.shiftChecked);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingSale, setViewingSale] = useState<any>(null);

  const load = () => {
    setLoading(true);
    setError("");
    posApi
      .getSalesHistory()
      .then(setSales)
      .catch((err) => setError(err.message || "No se pudo cargar el historial"))
      .finally(() => setLoading(false));
  };

  // Solo carga si ya hay un turno abierto — sin uno, no tiene sentido
  // mostrar facturas (ver ShiftRequiredNotice más abajo); vuelve a cargar
  // automáticamente en cuanto el cajero abre un turno estando en esta
  // pestaña.
  useEffect(() => {
    if (shiftId) load();
  }, [shiftId]);

  if (shiftChecked && !shiftId) {
    return <ShiftRequiredNotice />;
  }

  const total = sales.reduce((acc, s) => acc + s.total, 0);
  const approved = sales.filter((s) => s.dianStatus === "APPROVED").length;

  return (
    <div className="h-full overflow-y-auto p-6 bg-neutral-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Facturas de tu turno</h2>
          <p className="text-sm text-neutral-500">
            {sales.length} venta(s) · ${total.toLocaleString("es-CO")} · {approved} emitida(s)
          </p>
        </div>
        <button
          onClick={load}
          className="bg-white border border-neutral-200 hover:bg-neutral-100 text-sm font-medium px-4 py-2 rounded-lg"
        >
          Actualizar
        </button>
      </div>

      {loading && <p className="text-neutral-400 text-sm">Cargando...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {!loading && !error && sales.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-100 p-8 text-center text-neutral-400">
          Aún no has registrado ventas en este turno
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        {sales.map((sale, i) => {
          const status = statusLabels[sale.dianStatus] || statusLabels.PENDING;
          return (
            <div
              key={sale._id}
              className={`p-4 flex items-center justify-between gap-3 ${
                i > 0 ? "border-t border-neutral-50" : ""
              }`}
            >
              <div>
                <div className="text-sm font-medium">
                  ${sale.total.toLocaleString("es-CO")}{" "}
                  <span className="text-neutral-400 font-normal">· {sale.paymentMethod}</span>
                </div>
                <div className="text-xs text-neutral-400">
                  {formatTime(sale.createdAt)}
                  {sale.cufe && ` · CUFE: ${sale.cufe.slice(0, 20)}...`}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${status.className}`}>
                  {status.label}
                </span>
                <button
                  onClick={() => setViewingSale(sale)}
                  className="text-brand-600 hover:underline text-xs font-medium whitespace-nowrap"
                >
                  Ver recibo
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {viewingSale && (
        <SaleReceipt sale={viewingSale} onClose={() => setViewingSale(null)} />
      )}
    </div>
  );
}
