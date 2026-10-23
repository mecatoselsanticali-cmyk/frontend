import KpiCarousel from "../components/KpiCarousel";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import FinanzasTabs from "../components/FinanzasTabs";
import CashClosureModal from "../components/CashClosureModal";
import CashClosureDetailModal from "../components/CashClosureDetailModal";
import ActionsMenu from "../components/ActionsMenu";
import { Calendar, User, Plus, Wallet, Banknote, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatDateTime, toColombiaDateInput } from "../utils/timezone";

const money = (n?: number) => (n === undefined || n === null ? "—" : `$${n.toLocaleString("es-CO")}`);

interface Closure {
  _id: string;
  openedAt: string;
  closedAt?: string;
  status: "OPEN" | "CLOSED";
  reportType?: "X" | "Z";
  branchId?: { _id?: string; name?: string };
  cashierId?: { _id?: string; name?: string };
  initialCash?: number;
  initialNequi?: number;
  declaredCash?: number;
  difference?: number;
  nequiDifference?: number;
}

function AuditKpi({ label, value, detail, icon: Icon, loading, warning = false }: {
  label: string; value: string; detail: string; icon: LucideIcon; loading: boolean; warning?: boolean;
}) {
  return <section aria-busy={loading} className={`rounded-2xl border bg-white p-5 shadow-sm ${warning ? "border-amber-200" : "border-zinc-200/80"}`}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-medium text-zinc-500">{label}</h2><Icon size={19} className={warning ? "text-amber-500" : "text-zinc-400"} aria-hidden="true" /></div><p className={`text-2xl font-bold tracking-tight tabular-nums ${warning ? "text-amber-700" : "text-zinc-900"}`}>{loading ? "…" : value}</p><p className="mt-2 text-xs text-zinc-500">{detail}</p></section>;
}

function DifferenceBadge({ closure }: { closure: Closure }) {
  if (closure.status === "OPEN") return <span className="text-xs text-zinc-400">En turno</span>;
  if (closure.difference == null) return <span className="text-xs text-zinc-400">Sin reporte</span>;
  return <span className={`inline-flex items-center justify-end gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${closure.difference === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{closure.difference !== 0 && <TriangleAlert size={12} aria-hidden="true" />}{money(closure.difference)}</span>;
}

async function printReportZ(id: string) {
  const { closure, financials } = await adminApi.getCashClosureDetail(id);
  if (closure.status !== "CLOSED" || closure.reportType !== "Z") throw new Error("El informe Z requiere un cierre definitivo de caja.");
  const lines = ["MECATOS EL SANTI", "INFORME Z — CIERRE DE CAJA", `Registro: ${id}`, `Sede: ${closure.branchId?.name || "—"}`, `Cajero: ${closure.cashierId?.name || "—"}`, `Apertura: ${formatDateTime(closure.openedAt)}`, `Cierre: ${closure.closedAt ? formatDateTime(closure.closedAt) : "—"}`, "", `Base efectivo: ${money(closure.initialCash)}`, `Base Nequi: ${money(closure.initialNequi)}`, `Efectivo declarado: ${money(closure.declaredCash)}`, `Efectivo calculado: ${money(closure.systemCalculatedCash)}`, `Diferencia efectivo: ${money(closure.difference)}`, `Nequi declarado: ${money(closure.declaredNequi)}`, `Nequi calculado: ${money(closure.systemCalculatedNequi)}`, `Diferencia Nequi: ${money(closure.nequiDifference)}`, "", `Ventas efectivo: ${money(financials?.cashSales)}`, `Ventas Nequi: ${money(financials?.nequiTotal)}`, `Ventas aplicaciones: ${money(financials?.appsTotal)}`, `Ventas tarjeta: ${money(financials?.cardTotal)}`, `Gastos caja menor: ${money(financials?.pettyCashExpenses)}`, `Compras efectivo: ${money(financials?.cashPurchases)}`];
  const frame = document.createElement("iframe");
  frame.title = "Informe Z para impresión";
  frame.className = "fixed left-0 top-0 h-0 w-0 border-0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const printWindow = frame.contentWindow;
  if (!doc || !printWindow) { frame.remove(); throw new Error("No se pudo preparar la impresión."); }
  doc.title = `Informe Z ${id}`;
  const report = doc.createElement("pre");
  report.textContent = lines.join("\n");
  doc.body.appendChild(report);
  printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
  window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 100);
  window.setTimeout(() => frame.remove(), 60000);
}

// Misma "propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// Topbar.tsx/CashierLayout.tsx — no hay un hook compartido para esto en
// el proyecto (ver punto 36 de CLAUDE.md). Acá decide el `pageSize` de la
// paginación: 5 filas por página en celular en vez de las 11 de
// escritorio, para que "Anterior"/"Siguiente" no obligue a hacer scroll
// vertical largo en una pantalla angosta.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function FinanzasCaja() {
  const isMobile = useIsMobile();
  const [selectedBranch] = useSelectedBranch();
  const [records, setRecords] = useState<Closure[]>([]);
  const requestRef = useRef(0);
  const [error, setError] = useState("");
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<any>(null);
  const [viewingClosureId, setViewingClosureId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [cashierOptions, setCashierOptions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = isMobile ? 4 : 11;

  const load = () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError("");
    const collect = async () => {
      const all: Closure[] = [];
      let currentPage = 1;
      let lastPage = 1;
      do {
        const result = await adminApi.listCashClosures({ branchId: selectedBranch || undefined, page: currentPage, pageSize: 100 });
        if (request !== requestRef.current) return;
        all.push(...result.data);
        lastPage = result.totalPages;
        currentPage += 1;
      } while (currentPage <= lastPage);
      setRecords(all);
    };
    collect().catch(() => { if (request === requestRef.current) { setRecords([]); setError("No se pudieron cargar los registros de caja."); } }).finally(() => { if (request === requestRef.current) setLoading(false); });
  };

  useEffect(() => { load(); return () => { requestRef.current += 1; }; }, [selectedBranch]);
  useEffect(() => { setPage(1); }, [selectedBranch, from, to, cashierId, status, isMobile]);

  const periodRecords = records.filter((closure) => {
    const day = toColombiaDateInput(closure.openedAt);
    return (!from || day >= from) && (!to || day <= to) && (!cashierId || closure.cashierId?._id === cashierId);
  });
  const filtered = periodRecords.filter((closure) => !status || (status === "DIFFERENCE" ? closure.status === "CLOSED" && ((closure.difference ?? 0) !== 0 || (closure.nequiDifference ?? 0) !== 0) : closure.status === status));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const closures = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const openClosures = records.filter((closure) => closure.status === "OPEN");
  const activeCash = openClosures.reduce((sum, closure) => sum + (closure.initialCash ?? 0), 0);
  const risk = periodRecords.filter((closure) => closure.status === "CLOSED").reduce((sum, closure) => sum + Math.abs(closure.difference ?? 0) + Math.abs(closure.nequiDifference ?? 0), 0);

  const handlePrint = async (closure: Closure) => {
    setPrintingId(closure._id);
    try { await printReportZ(closure._id); }
    catch (error: any) { Swal.fire({ title: "No se pudo imprimir", text: error.message, icon: "error" }); }
    finally { setPrintingId(null); }
  };

  // Opciones del filtro "Cajero" — mismo endpoint que usa CashClosureModal.tsx
  // para su propio selector (solo usuarios con rol CASHIER, activos, de la
  // sede vigente). Se recarga al cambiar de sede.
  useEffect(() => {
    adminApi
      .listCashiersForClosures(selectedBranch || undefined)
      .then(setCashierOptions)
      .catch(() => setCashierOptions([]));
  }, [selectedBranch]);

  const openCreate = () => {
    setEditingClosure(null);
    setModalOpen(true);
  };

  const openEdit = (closure: any) => {
    setEditingClosure(closure);
    setModalOpen(true);
  };

  const handleDelete = async (closure: any) => {
    const result = await Swal.fire({
      title: "¿Eliminar este registro de caja?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    try {
      await adminApi.deleteCashClosure(closure._id);
      load();
      Swal.fire({ title: "Registro eliminado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo eliminar el registro", icon: "error" });
    }
  };

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setStatus("");
    setCashierId("");
  };

  return (
    <div className="space-y-4">
      <FinanzasTabs />

      <KpiCarousel label="Métricas de auditoría de caja">
        <AuditKpi label="Cajas Activas en Turno" value={error ? "—" : `${openClosures.length} Cajas Abiertas`} detail="Estado actual de la sede seleccionada" icon={Wallet} loading={loading} />
        <AuditKpi label="Total Base en Efectivo Activa" value={error ? "—" : money(activeCash)} detail="Base de efectivo de los turnos abiertos" icon={Banknote} loading={loading} />
        <AuditKpi label="Diferencias / Descuadres acumulados" value={error ? "—" : money(risk)} detail="Valores absolutos en efectivo y Nequi · Periodo y cajero seleccionados" icon={TriangleAlert} warning={risk > 0} loading={loading} />
      </KpiCarousel>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <fieldset className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2"><legend className="sr-only">Rango de fechas de apertura</legend><Calendar size={17} className="text-zinc-400" aria-hidden="true" /><input type="date" aria-label="Desde" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="min-w-0 rounded bg-white py-0.5 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20" /><span className="text-xs text-zinc-400">a</span><input type="date" aria-label="Hasta" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="min-w-0 rounded bg-white py-0.5 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></fieldset>
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-zinc-400"><User size={17} className="shrink-0" aria-hidden="true" /><select aria-label="Cajero" value={cashierId} onChange={(event) => setCashierId(event.target.value)} className="min-w-0 w-full bg-white text-sm text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><option value="">Cajero: todos</option>{cashierOptions.map((cashier) => <option key={cashier._id} value={cashier._id}>{cashier.name}</option>)}</select></label>
          <select aria-label="Estado de Caja" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"><option value="">Todas las cajas</option><option value="OPEN">Abiertas</option><option value="CLOSED">Cerradas</option><option value="DIFFERENCE">Con descuadre</option></select>
          {(from || to || cashierId || status) && <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-50">Limpiar filtros</button>}
        </div>
        <button type="button" onClick={openCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:w-auto"><Plus size={17} aria-hidden="true" />Nuevo registro</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      <div className="bg-white rounded-xl border border-zinc-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="p-3 whitespace-nowrap">Apertura</th>
                {/* Diferencia se adelanta justo después de "Apertura" (antes
                    de Sede/Cajero) para que sea lo primero alcanzable con
                    scroll en celular — es el número que un admin/gerente
                    más necesita ver de un vistazo para detectar un cuadre
                    con problemas, mismo criterio que "Monto"/"Total" en
                    Compras.tsx/Ventas.tsx/Gastos.tsx, ver punto 36 de
                    CLAUDE.md. */}
                <th className="p-3 whitespace-nowrap text-right">Diferencia</th>
                <th className="p-3 whitespace-nowrap">Sede</th>
                <th className="p-3 whitespace-nowrap">Cajero</th>
                <th className="p-3 whitespace-nowrap text-right">Base efectivo</th>
                <th className="p-3 whitespace-nowrap text-right hidden sm:table-cell">Base Nequi</th>
                <th className="p-3 whitespace-nowrap text-right">Declarado</th>
                <th className="p-3 whitespace-nowrap hidden sm:table-cell">Tipo</th>
                <th className="p-3 whitespace-nowrap">Estado</th>
                <th className="p-3 whitespace-nowrap text-center sticky right-0 z-10 bg-neutral-50 border-l border-neutral-200">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-neutral-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && closures.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-neutral-400">
                    No hay registros de caja todavía
                  </td>
                </tr>
              )}
              {!loading && closures.map((c) => (
                <tr key={c._id} className="border-t border-zinc-100 transition-colors hover:bg-zinc-50/80">
                  <td className="p-3 text-neutral-500">{formatDateTime(c.openedAt)}</td>
                  <td className="p-3 text-right tabular-nums"><DifferenceBadge closure={c} /></td>
                  <td className="p-3"><span title={c.branchId?.name} className="whitespace-nowrap rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{c.branchId?.name?.replace(/^Mecatos\s+el\s+Santi\s*[-–—:]?\s*/i, "") || c.branchId?.name || "—"}</span></td>
                  <td className="p-3"><div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[10px] font-semibold text-zinc-600">{c.cashierId?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "C"}</span><span className="text-zinc-700">{c.cashierId?.name || "—"}</span></div></td>
                  <td className="p-3 text-right font-medium tabular-nums text-zinc-900">{money(c.initialCash)}</td>
                  <td className="hidden p-3 text-right font-medium tabular-nums text-zinc-900 sm:table-cell">{money(c.initialNequi)}</td>
                  <td className="p-3 text-right font-medium tabular-nums text-zinc-900">{money(c.declaredCash)}</td>
                  <td className="hidden p-3 sm:table-cell"><span className="whitespace-nowrap rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">{c.reportType ? `Informe ${c.reportType}` : "—"}</span></td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                        c.status === "OPEN" ? "bg-amber-50 text-amber-700 border-amber-200/80" : "bg-zinc-100 text-zinc-600 border-zinc-200/60"
                      }`}
                    >
                      {c.status === "OPEN" ? "Abierto" : "Cerrado"}
                    </span>
                  </td>
                  <td className="p-3 sticky right-0 z-10 bg-white border-l border-neutral-200">
                    <div className="flex justify-center">
                      <ActionsMenu
                        items={[
                          { label: "Ver arqueo detallado", onClick: () => setViewingClosureId(c._id) },
                          { label: "Imprimir Reporte Z", disabled: c.status !== "CLOSED" || c.reportType !== "Z" || printingId === c._id, title: "Disponible para cierres definitivos de tipo Z", onClick: () => handlePrint(c) },
                          { label: "Ajustar diferencia", disabled: c.status !== "CLOSED", onClick: () => openEdit(c) },
                          { label: "Editar", onClick: () => openEdit(c) },
                          { label: "Eliminar", danger: true, onClick: () => handleDelete(c) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} registro{total === 1 ? "" : "s"} · página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <CashClosureModal
          closure={editingClosure}
          initialBranchId={selectedBranch || undefined}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

      {viewingClosureId && (
        <CashClosureDetailModal closureId={viewingClosureId} onClose={() => setViewingClosureId(null)} />
      )}
    </div>
  );
}
