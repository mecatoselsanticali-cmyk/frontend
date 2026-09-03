import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import FinanzasTabs from "../components/FinanzasTabs";
import CashClosureModal from "../components/CashClosureModal";
import CashClosureDetailModal from "../components/CashClosureDetailModal";
import ActionsMenu from "../components/ActionsMenu";
import { formatDateTime } from "../utils/timezone";

const money = (n?: number) => (n === undefined || n === null ? "—" : `$${n.toLocaleString("es-CO")}`);

export default function FinanzasCaja() {
  const [selectedBranch] = useSelectedBranch();
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<any>(null);
  const [viewingClosureId, setViewingClosureId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [cashierOptions, setCashierOptions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    adminApi
      .listCashClosures({
        branchId: selectedBranch || undefined,
        from: date || undefined,
        to: date || undefined,
        cashierId: cashierId || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setClosures(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch, date, cashierId, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedBranch, date, cashierId]);

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

  return (
    <div className="space-y-4">
      <FinanzasTabs />

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-neutral-500 text-sm">
          Aperturas y cierres de caja reportados por los cajeros — puedes agregar, editar o
          eliminar cualquier registro.
        </h3>
        <button
          onClick={openCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto shrink-0"
        >
          + Nuevo registro
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={cashierId}
          onChange={(e) => setCashierId(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Cajero: todos</option>
          {cashierOptions.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
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
                <th className="p-3 whitespace-nowrap">Diferencia</th>
                <th className="p-3 whitespace-nowrap">Sede</th>
                <th className="p-3 whitespace-nowrap">Cajero</th>
                <th className="p-3 whitespace-nowrap">Base efectivo</th>
                <th className="p-3 whitespace-nowrap hidden sm:table-cell">Base Nequi</th>
                <th className="p-3 whitespace-nowrap">Declarado</th>
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
              {closures.map((c) => (
                <tr key={c._id} className="border-t border-neutral-50">
                  <td className="p-3 text-neutral-500">{formatDateTime(c.openedAt)}</td>
                  <td className="p-3">
                    {c.difference === undefined || c.difference === null ? (
                      "—"
                    ) : (
                      <span className={c.difference === 0 ? "text-green-600" : "text-red-500"}>
                        {money(c.difference)}
                      </span>
                    )}
                  </td>
                  <td className="p-3">{c.branchId?.name || "—"}</td>
                  <td className="p-3">{c.cashierId?.name || "—"}</td>
                  <td className="p-3">{money(c.initialCash)}</td>
                  <td className="p-3 hidden sm:table-cell">{money(c.initialNequi)}</td>
                  <td className="p-3">{money(c.declaredCash)}</td>
                  <td className="p-3 hidden sm:table-cell">{c.reportType || "—"}</td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        c.status === "OPEN" ? "bg-amber-50 text-amber-600" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {c.status === "OPEN" ? "Abierto" : "Cerrado"}
                    </span>
                  </td>
                  <td className="p-3 sticky right-0 z-10 bg-white border-l border-neutral-200">
                    <div className="flex justify-center">
                      <ActionsMenu
                        items={[
                          { label: "Ver", onClick: () => setViewingClosureId(c._id) },
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
            {total} registro{total === 1 ? "" : "s"} · página {page} de {totalPages}
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
