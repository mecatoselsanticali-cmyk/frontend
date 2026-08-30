import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import ExpenseModal from "../components/ExpenseModal";
import ExpenseEditModal from "../components/ExpenseEditModal";
import ActionsMenu from "../components/ActionsMenu";
import { formatDateTime } from "../utils/timezone";

const categoryLabels: Record<string, string> = {
  PETTY_CASH: "Caja menor",
  ARRIENDO: "Arriendo",
  NOMINA: "Nómina",
  SERVICIOS_PUBLICOS: "Servicios públicos",
  OTRO: "Otro",
};

export default function Gastos() {
  const [selectedBranch] = useSelectedBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

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

  useEffect(load, [selectedBranch, category, date, page]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
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
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
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
