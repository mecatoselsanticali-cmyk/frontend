import { useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import FinanzasTabs from "../components/FinanzasTabs";
import { todayColombia, firstOfMonthForDateString } from "../utils/timezone";

// Antes usaban `new Date().toISOString().slice(0, 10)` — eso da el día
// calendario en UTC, no en Bogotá (mismo bug que en Dashboard.tsx: después
// de las 7pm hora Bogotá, UTC ya cruzó a mañana). `todayColombia()` da el
// día calendario correcto sin importar la zona horaria del navegador.
const todayInput = () => todayColombia();
const firstOfMonthInput = () => firstOfMonthForDateString(todayColombia());

/**
 * Descarga el reporte y lo entrega al navegador vía un <a download> temporal
 * — el backend genera el archivo (Excel o PDF), acá solo se recibe el blob
 * y se dispara la descarga estándar del navegador.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FinanzasReportes() {
  const [selectedBranch] = useSelectedBranch();
  const [from, setFrom] = useState(firstOfMonthInput());
  const [to, setTo] = useState(todayInput());
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      const blob = await adminApi.exportReport({
        format,
        branchId: selectedBranch || undefined,
        from,
        to,
      });
      downloadBlob(blob, `reporte-financiero-${from}-a-${to}.${format}`);
    } catch (err: any) {
      Swal.fire({
        title: "No se pudo generar el reporte",
        text: err.message || "Intenta de nuevo",
        icon: "error",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <FinanzasTabs />

      <div className="bg-white rounded-xl border border-neutral-100 p-6 space-y-5 max-w-xl">
        <div>
          <h3 className="text-base font-bold">Reporte financiero</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Resumen y detalle de ventas, compras y gastos en el rango de fechas elegido, para la
            sede seleccionada arriba (o todas las sedes si no eliges ninguna).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-500">Desde</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleExport("xlsx")}
            disabled={exporting !== null}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
          >
            {exporting === "xlsx" ? "Generando..." : "Exportar Excel"}
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="flex-1 bg-neutral-800 hover:bg-neutral-900 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
          >
            {exporting === "pdf" ? "Generando..." : "Exportar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
