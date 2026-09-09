import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import DataTable from "../components/DataTable";
import BranchModal from "../components/BranchModal";
import MoreFiltersModal from "../components/MoreFiltersModal";
import { SquarePen, Trash2 } from "lucide-react";

// Misma "propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// Topbar.tsx/CashierLayout.tsx — no hay un hook compartido para esto en
// el proyecto (ver punto 36 de CLAUDE.md). Acá decide el `pageSize` de la
// paginación: 5 filas por página en celular en vez de las 20 de
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

export default function Sedes() {
  const isMobile = useIsMobile();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Modal "Más filtros" de la vista de celular (ver punto 63 de CLAUDE.md)
  // — solo `search` queda visible fuera del modal; "Mostrar inactivas"
  // vive adentro (aunque sea el único filtro extra, se mantiene el mismo
  // patrón que el resto de páginas de este panel).
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const pageSize = isMobile ? 5 : 20;

  const load = () => {
    setLoading(true);
    adminApi
      .listBranches({ includeInactive: showInactive, search: search || undefined, page, pageSize })
      .then((res) => {
        setBranches(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
        // Si una eliminación dejó la página actual vacía, retrocede a la
        // última página real (mismo patrón que Inventario.tsx/Personal.tsx).
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [showInactive, search, page, isMobile]);

  // Cambiar el filtro de inactivas o el término de búsqueda debe volver a
  // la página 1 — si no, se podría quedar en una página que ya no existe
  // para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [showInactive, search]);

  const openCreate = () => {
    setEditingBranch(null);
    setModalOpen(true);
  };

  const openEdit = (branch: any) => {
    setEditingBranch(branch);
    setModalOpen(true);
  };

  const handleDelete = async (branch: any) => {
    const result = await Swal.fire({
      title: `¿Eliminar "${branch.name}"?`,
      text: "La sede quedará inactiva. Se puede reactivar luego.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    setBusyId(branch._id);
    try {
      await adminApi.updateBranch(branch._id, { status: false });
      load();
      Swal.fire({ title: "Sede eliminada", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo eliminar la sede", icon: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (branch: any) => {
    setBusyId(branch._id);
    try {
      await adminApi.updateBranch(branch._id, { status: true });
      load();
      Swal.fire({ title: "Sede reactivada", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo reactivar la sede", icon: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const extraFiltersCount = [showInactive].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {!isMobile && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-neutral-500 text-sm">Sedes de la cadena</h3>
            <input
              placeholder="Buscar por nombre, dirección o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
            />
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostrar inactivas
            </label>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto"
          >
            + Nueva sede
          </button>
        </div>
      )}

      {/* Vista de celular (ver punto 63 de CLAUDE.md) — solo el buscador
          queda visible junto al botón "Más filtros"; "Mostrar inactivas"
          vive en el modal. */}
      {isMobile && (
        <>
          <div className="flex gap-2">
            <input
              placeholder={`${isMobile ? "Buscar..." : "Buscar por nombre, dirección o teléfono..."}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={() => setFiltersModalOpen(true)}
              className="relative shrink-0 px-3 py-2 rounded-lg text-sm font-medium border bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            >
              Más filtros
              {extraFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {extraFiltersCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full"
          >
            + Nueva sede
          </button>
        </>
      )}

      {filtersModalOpen && (
        <MoreFiltersModal onClose={() => setFiltersModalOpen(false)}>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivas
          </label>
        </MoreFiltersModal>
      )}

      <DataTable
        loading={loading}
        rows={branches}
        emptyMessage="No hay sedes registradas todavía"
        columns={[
          { key: "name", label: "Nombre" },
          { key: "address", label: "Dirección" },
          { key: "phone", label: "Teléfono", hideOnMobile: true },
          {
            key: "dianResponsible",
            label: "Responsable de DIAN",
            render: (r) => (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  r.dianResponsible ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {r.dianResponsible ? "Sí" : "No"}
              </span>
            ),
          },
          {
            key: "status",
            label: "Estado",
            render: (r) => (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  r.status ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {r.status ? "Activa" : "Inactiva"}
              </span>
            ),
          },
          {
            key: "actions",
            label: "Acciones",
            stickyRight: true,
            centerHeader: true,
            render: (r) => (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => openEdit(r)}
                  className="text-brand-600 hover:underline text-xs font-medium"
                >
                  <SquarePen size={20} />
                </button>
                {r.status ? (
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={busyId === r._id}
                    className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50"
                  >
                    {busyId === r._id ? "Eliminando..." : <Trash2 size={20} />}
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(r)}
                    disabled={busyId === r._id}
                    className="text-green-600 hover:underline text-xs font-medium disabled:opacity-50"
                  >
                    {busyId === r._id ? "Reactivando..." : "Reactivar"}
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} sede{total === 1 ? "" : "s"} · página {page} de {totalPages}
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
        <BranchModal
          branch={editingBranch}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
