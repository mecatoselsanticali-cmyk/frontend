import KpiCarousel from "../components/KpiCarousel";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import ExpenseModal from "../components/ExpenseModal";
import ExpenseEditModal from "../components/ExpenseEditModal";
import ActionsMenu from "../components/ActionsMenu";
import { Tag, Calendar, Search, Plus, Receipt, ChartPie, Wallet, X, type LucideIcon } from "lucide-react";
import { formatDate, formatTime } from "../utils/timezone";

const categoryLabels: Record<string, string> = {
  PETTY_CASH: "Caja menor",
  ARRIENDO: "Arriendo",
  NOMINA: "Nómina",
  SERVICIOS_PUBLICOS: "Servicios públicos",
  OTRO: "Otro",
};

interface Expense {
  _id: string;
  amount: number;
  category: string;
  concept: string;
  createdAt: string;
  branchId?: { name?: string };
  receiptImageUrl?: string;
}

const money = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const titleCase = (value: string) => value.trim().toLocaleLowerCase("es-CO").replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-CO"));
const categoryColors: Record<string, string> = {
  NOMINA: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
  ARRIENDO: "bg-amber-50 text-amber-700 border-amber-200/60",
  SERVICIOS_PUBLICOS: "bg-sky-50 text-sky-700 border-sky-200/60",
  PETTY_CASH: "bg-orange-50 text-orange-700 border-orange-200/60",
  OTRO: "bg-zinc-100 text-zinc-700 border-zinc-200/60",
};

function ExpenseCategory({ category }: { category: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${categoryColors[category] || categoryColors.OTRO}`}>{categoryLabels[category] || category}</span>;
}

function ExpenseKpi({ label, value, detail, icon: Icon, loading }: {
  label: string; value: string; detail: string; icon: LucideIcon; loading: boolean;
}) {
  return <section aria-busy={loading} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-medium text-zinc-500">{label}</h2><Icon size={19} className="text-orange-500" aria-hidden="true" /></div><p className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">{loading ? "…" : value}</p><p className="mt-2 text-xs text-zinc-500">{loading ? "Cargando…" : detail}</p></section>;
}

function ExpenseVoucher({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault(); closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => { window.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 !m-0 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="expense-voucher-title" className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between gap-3"><h2 id="expense-voucher-title" className="text-lg font-semibold text-zinc-900">Comprobante de gasto</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar comprobante" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-orange-500"><X size={18} /></button></header>
      <p className="mt-5 text-3xl font-bold text-rose-600">{money(expense.amount)}</p>
      <p className="mb-4 mt-2 text-sm font-medium text-zinc-700">{titleCase(expense.concept || "Sin concepto")}</p>
      <ExpenseCategory category={expense.category} />
      <dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-zinc-400">Sede</dt><dd className="text-right text-zinc-700">{expense.branchId?.name || "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-400">Fecha</dt><dd className="text-right text-zinc-700">{formatDate(expense.createdAt)} · {formatTime(expense.createdAt, { hour: "2-digit", minute: "2-digit" })}</dd></div></dl>
      <p className="mt-5 break-all rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-500">ID: {expense._id}</p>
      <p className="mt-3 text-xs text-zinc-400">Resumen del registro de gasto; no sustituye el comprobante del proveedor.</p>
    </section>
  </div>;
}

// Misma "propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// Topbar.tsx/CashierLayout.tsx — no hay un hook compartido para esto en
// el proyecto (ver punto 36 de CLAUDE.md). Acá decide el `pageSize` de la
// paginación: 5 filas por página en celular en vez de las 12/20 de
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

export default function Gastos() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") !== "true") return;
    setModalOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("new");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  const [selectedBranch] = useSelectedBranch();
  const [records, setRecords] = useState<Expense[]>([]);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [page, setPage] = useState(1);
  const pageSize = isMobile ? 5 : 12;

  // La API no filtra por concepto: reúne todas las páginas del rango antes
  // de buscar y paginar para que la tabla y los KPI describan el mismo resultado.
  const load = () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError("");
    const collect = async () => {
      const all: Expense[] = [];
      let currentPage = 1;
      let lastPage = 1;
      do {
        const result = await adminApi.listExpenses({ branchId: selectedBranch || undefined, category: category || undefined, from: from || undefined, to: to || undefined, page: currentPage, pageSize: 100 });
        if (request !== requestRef.current) return;
        all.push(...result.data);
        lastPage = result.totalPages;
        currentPage += 1;
      } while (currentPage <= lastPage);
      setRecords(all);
    };
    collect().catch(() => { if (request === requestRef.current) { setRecords([]); setError("No se pudieron cargar los gastos."); } })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
  };

  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [selectedBranch, category, from, to]);

  useEffect(() => { setPage(1); }, [selectedBranch, category, from, to, search, isMobile]);

  const filtered = useMemo(() => records.filter((expense) => (expense.concept || "").toLocaleLowerCase("es-CO").includes(search.trim().toLocaleLowerCase("es-CO"))), [records, search]);
  const total = filtered.length;
  const totalAmount = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const categoryTotals = filtered.reduce<Record<string, number>>((totals, expense) => { totals[expense.category] = (totals[expense.category] || 0) + expense.amount; return totals; }, {});
  const largestCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  const openModal = () => {
    if (!selectedBranch) {
      Swal.fire({
        title: "Selecciona una sede",
        text: "Elige una sede en la barra superior antes de registrar un gasto.",
        icon: "warning",
      });
      return;
    }
    setModalOpen(true);
  };

  const handleDelete = async (expense: any) => {
    const result = await Swal.fire({
      title: "¿Eliminar este gasto?",
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
      await adminApi.deleteExpense(expense._id);
      load();
      Swal.fire({ title: "Gasto eliminado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo eliminar el gasto", icon: "error" });
    }
  };

  const clearFilters = () => {
    setCategory("");
    setFrom("");
    setTo("");
    setSearch("");
  };

  return (
    <div className="space-y-4">
      <KpiCarousel label="Métricas de gastos">
        <ExpenseKpi label="Total Gastado" value={error ? "—" : money(totalAmount)} detail={`${total} ${total === 1 ? "egreso" : "egresos"}`} icon={Wallet} loading={loading} />
        <ExpenseKpi label="Mayor Categoría de Gasto" value={error ? "—" : largestCategory ? categoryLabels[largestCategory[0]] || largestCategory[0] : "Sin gastos"} detail={largestCategory && totalAmount ? `${(largestCategory[1] / totalAmount * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}% del total gastado` : "Sin participación en el periodo"} icon={ChartPie} loading={loading} />
        <ExpenseKpi label="Promedio por Gasto" value={error ? "—" : money(total ? totalAmount / total : 0)} detail="Según los filtros seleccionados" icon={Receipt} loading={loading} />
      </KpiCarousel>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <label className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-zinc-400"><Tag size={17} className="shrink-0" aria-hidden="true" /><select aria-label="Categoría" value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-0 w-full bg-white text-sm text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><option value="">Todas las categorías</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <fieldset className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2"><legend className="sr-only">Rango de fechas</legend><Calendar size={17} className="text-zinc-400" aria-hidden="true" /><input type="date" aria-label="Desde" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="min-w-0 rounded bg-white py-0.5 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20" /><span className="text-xs text-zinc-400">a</span><input type="date" aria-label="Hasta" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="min-w-0 rounded bg-white py-0.5 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></fieldset>
          <div className="relative min-w-0 flex-1"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" /><input aria-label="Buscar por concepto" placeholder="Buscar por concepto…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></div>
          {(category || from || to || search) && <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50">Limpiar filtros</button>}
        </div>
        <button type="button" onClick={openModal} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:w-auto"><Plus size={17} aria-hidden="true" />Nuevo gasto</button>
      </div>
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" onClick={load} className="font-medium underline">Reintentar</button></div>}
      <DataTable
        loading={loading}
        rows={rows}
        emptyMessage="No hay gastos registrados"
        columns={[
          {
            key: "createdAt",
            label: "Fecha",
            render: (r) => <div className="whitespace-nowrap"><p className="font-medium text-zinc-700">{formatDate(r.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</p><p className="mt-1 text-xs text-zinc-400">{formatTime(r.createdAt, { hour: "2-digit", minute: "2-digit", hour12: true })}</p></div>,
          },
          {
            // Adelantado justo después de "Fecha" (antes de "Concepto") para
            // que sea lo primero alcanzable con scroll en celular — mismo
            // criterio que "Monto"/"Total" en Compras.tsx/Ventas.tsx, ver
            // punto 36 de CLAUDE.md.
            key: "amount",
            label: "Monto",
            align: "right",
            render: (r) => <span className="whitespace-nowrap font-semibold text-rose-600">{money(r.amount)}</span>,
          },
          { key: "concept", label: "Concepto", render: (r) => <span className="font-medium text-zinc-700">{titleCase(r.concept || "Sin concepto")}</span> },
          {
            key: "category",
            label: "Categoría",
            hideOnMobile: true,
            render: (r) => <ExpenseCategory category={r.category} />,
          },
          {
            key: "branchId",
            label: "Sede",
            render: (r) => <span title={r.branchId?.name} className="whitespace-nowrap rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{r.branchId?.name?.replace(/^Mecatos\s+el\s+Santi\s*[-–—:]?\s*/i, "") || r.branchId?.name || "—"}</span>,
          },
          {
            key: "acciones",
            label: "Acciones",
            stickyRight: true,
            centerHeader: true,
            render: (r) => (
              <div className="flex justify-center">
                <ActionsMenu
                  items={[
                    { label: "Ver comprobante", onClick: () => setViewingExpense(r) },
                    { label: "Editar", onClick: () => setEditingExpense(r) },
                    { label: "Eliminar", danger: true, onClick: () => handleDelete(r) },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} gasto{total === 1 ? "" : "s"} · página {currentPage} de {totalPages}
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
        <ExpenseModal
          branchId={selectedBranch}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

      {viewingExpense && <ExpenseVoucher expense={viewingExpense} onClose={() => setViewingExpense(null)} />}

      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
