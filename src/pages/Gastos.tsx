import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import ExpenseModal from "../components/ExpenseModal";
import ExpenseEditModal from "../components/ExpenseEditModal";
import ActionsMenu from "../components/ActionsMenu";
import MoreFiltersModal from "../components/MoreFiltersModal";
import { formatDateTime } from "../utils/timezone";

const categoryLabels: Record<string, string> = {
  PETTY_CASH: "Caja menor",
  ARRIENDO: "Arriendo",
  NOMINA: "Nómina",
  SERVICIOS_PUBLICOS: "Servicios públicos",
  OTRO: "Otro",
};

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
  const [selectedBranch] = useSelectedBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  // Modal "Más filtros" de la vista de celular (ver punto 63 de CLAUDE.md)
  // — esta página no tiene buscador de texto, así que en celular no queda
  // NINGÚN filtro visible fuera del modal, solo el botón que lo abre.
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = isMobile ? 5 : 12;

  const load = () => {
    setLoading(true);
    adminApi
      .listExpenses({
        branchId: selectedBranch || undefined,
        category: category || undefined,
        from: date || undefined,
        to: date || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setRows(res.data);
        setTotal(res.total);
        setTotalAmount(res.totalAmount);
        setTotalPages(res.totalPages);
        // Si un filtro deja la página actual vacía, retrocede a la última
        // página real (mismo patrón que Compras.tsx/Personal.tsx).
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch, category, date, page, isMobile]);

  // Cambiar de sede, categoría o fecha debe volver a la página 1 — si no,
  // se podría quedar en una página que ya no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [selectedBranch, category, date]);

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

  const extraFiltersCount = [category, date].filter(Boolean).length;

  // "Limpiar filtros" del modal "Más filtros" (ver punto 63 de CLAUDE.md)
  // — resetea los dos filtros de esta página a su valor por defecto.
  const clearFilters = () => {
    setCategory("");
    setDate("");
  };

  return (
    <div className="space-y-4">
      {!isMobile && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todas las categorías</option>
              <option value="PETTY_CASH">Caja menor</option>
              <option value="ARRIENDO">Arriendo</option>
              <option value="NOMINA">Nómina</option>
              <option value="SERVICIOS_PUBLICOS">Servicios públicos</option>
              <option value="OTRO">Otro</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
            <div className="text-sm text-neutral-500">
              Total: <span className="font-bold text-neutral-800">${totalAmount.toLocaleString("es-CO")}</span>
            </div>
          </div>
          <button
            onClick={openModal}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto shrink-0"
          >
            + Nuevo gasto
          </button>
        </div>
      )}

      {/* Vista de celular (ver punto 63 de CLAUDE.md) — esta página no
          tiene buscador de texto, así que acá no queda ningún filtro
          visible, solo el botón que abre el modal con los dos. */}
      {isMobile && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-neutral-500">
              Total: <span className="font-bold text-neutral-800">${totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <button
              onClick={() => setFiltersModalOpen(true)}
              className="relative shrink-0 px-3 py-2 rounded-lg text-sm font-medium border bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            >
              Filtros
              {extraFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {extraFiltersCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={openModal}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full"
          >
            + Nuevo gasto
          </button>
        </div>
      )}

      {filtersModalOpen && (
        <MoreFiltersModal onClose={() => setFiltersModalOpen(false)} onClear={clearFilters}>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todas las categorías</option>
              <option value="PETTY_CASH">Caja menor</option>
              <option value="ARRIENDO">Arriendo</option>
              <option value="NOMINA">Nómina</option>
              <option value="SERVICIOS_PUBLICOS">Servicios públicos</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
          </div>
        </MoreFiltersModal>
      )}

      <DataTable
        loading={loading}
        rows={rows}
        emptyMessage="No hay gastos registrados"
        columns={[
          {
            key: "createdAt",
            label: "Fecha",
            render: (r) => formatDateTime(r.createdAt),
          },
          {
            // Adelantado justo después de "Fecha" (antes de "Concepto") para
            // que sea lo primero alcanzable con scroll en celular — mismo
            // criterio que "Monto"/"Total" en Compras.tsx/Ventas.tsx, ver
            // punto 36 de CLAUDE.md.
            key: "amount",
            label: "Monto",
            render: (r) => `$${r.amount.toLocaleString("es-CO")}`,
          },
          { key: "concept", label: "Concepto" },
          {
            key: "category",
            label: "Categoría",
            hideOnMobile: true,
            render: (r) => categoryLabels[r.category],
          },
          {
            key: "branchId",
            label: "Sede",
            render: (r) => r.branchId?.name || "—",
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
            {total} gasto{total === 1 ? "" : "s"} · página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
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
