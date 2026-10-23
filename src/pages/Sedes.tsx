import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import DataTable from "../components/DataTable";
import BranchModal from "../components/BranchModal";
import ActionsMenu from "../components/ActionsMenu";
import { SquarePen, Trash2, LayoutGrid, Table, Search, Plus, Building2, MapPin, Phone, BadgeCheck, ArrowUpRight } from "lucide-react";

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

interface Branch {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  nit?: string;
  status: boolean;
  dianResponsible?: boolean;
}

function BranchStatus({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${active ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}>{active ? "Activa" : "Inactiva"}</span>;
}

function BranchCard({ branch, busy, onEdit, onDelete, onReactivate }: {
  branch: Branch;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReactivate: () => void;
}) {
  return (
    <article aria-busy={busy} className="flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <header className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0 space-y-2">
          <h2 className="break-words text-base font-semibold tracking-tight text-zinc-900">{branch.name}</h2>
          <BranchStatus active={branch.status} />
        </div>
        {!busy && <ActionsMenu items={[
          { label: "Editar", onClick: onEdit },
          branch.status ? { label: "Eliminar", danger: true, onClick: onDelete } : { label: "Reactivar", onClick: onReactivate },
        ]} />}
      </header>
      <div className="flex-1 space-y-3 px-5 pb-5">
        <p className="flex items-start gap-3 text-sm leading-6 text-zinc-500"><MapPin size={17} className="mt-1 shrink-0 text-zinc-400" aria-hidden="true" /><span className="break-words">{branch.address || "Sin dirección registrada"}</span></p>
        <p className="flex items-center gap-3 text-sm text-zinc-500"><Phone size={17} className="shrink-0 text-zinc-400" aria-hidden="true" />{branch.phone || "Sin teléfono registrado"}</p>
        {branch.nit && <p className="text-xs text-zinc-400">NIT {branch.nit}</p>}
        {branch.dianResponsible && <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"><BadgeCheck size={14} aria-hidden="true" />Responsable DIAN</span>}
      </div>
      <footer className="border-t border-zinc-100 p-4">
        <button type="button" disabled={busy} onClick={onEdit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50">{busy ? "Actualizando…" : "Administrar"}<ArrowUpRight size={16} aria-hidden="true" /></button>
      </footer>
    </article>
  );
}

export default function SedesView() {
  const isMobile = useIsMobile();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const pageSize = isMobile ? 6 : 20;

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

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setModalOpen(true);
  };

  const handleDelete = async (branch: Branch) => {
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
      // Desactivar una sede también debe sacarla del selector de Topbar.tsx
      // (Layout.tsx la carga con `includeInactive` sin marcar, o sea solo
      // activas) — mismo evento que BranchModal.tsx dispara al crear/
      // editar, ver el comentario ahí.
      window.dispatchEvent(new Event("mecatos:branches-changed"));
      Swal.fire({ title: "Sede eliminada", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo eliminar la sede", icon: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (branch: Branch) => {
    setBusyId(branch._id);
    try {
      await adminApi.updateBranch(branch._id, { status: true });
      load();
      window.dispatchEvent(new Event("mecatos:branches-changed"));
      Swal.fire({ title: "Sede reactivada", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo reactivar la sede", icon: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setShowInactive(false);
  };

  return (
    <div className="space-y-4">
      <header className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-xl font-semibold tracking-tight text-zinc-900">Sedes</h1><p className="mt-1 text-sm text-zinc-500">Administra las sedes de la cadena.</p></div>
          <div className="flex items-center gap-3">
            <div role="group" aria-label="Vista de sedes" className="flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              {([{ value: "grid", label: "Vista Grid", icon: LayoutGrid }, { value: "table", label: "Vista Tabla", icon: Table }] as const).map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${view === value ? "bg-white text-orange-600 shadow-sm" : "text-zinc-400 hover:text-zinc-700"}`}><Icon size={18} aria-hidden="true" /></button>)}
            </div>
            <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"><Plus size={17} aria-hidden="true" />Nueva sede</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-0 flex-1 basis-64"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" /><input aria-label="Buscar sedes por nombre, dirección, teléfono o NIT" placeholder="Buscar por nombre, dirección, teléfono o NIT…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500" /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-orange-600 focus-visible:outline-orange-500" />Mostrar inactivas</label>
        </div>
      </header>

      {loading ? (
        <div role="status" aria-label="Cargando sedes" className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => <div key={index} aria-hidden="true" className="animate-pulse space-y-5 rounded-2xl border border-zinc-200 bg-white p-5"><div className="h-5 w-2/3 rounded bg-zinc-100" /><div className="h-5 w-16 rounded-full bg-zinc-100" /><div className="h-4 w-full rounded bg-zinc-100" /><div className="h-4 w-1/2 rounded bg-zinc-100" /><div className="h-10 rounded-xl bg-zinc-50" /></div>)}
        </div>
      ) : branches.length === 0 ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
          <div className="mb-4 rounded-2xl bg-zinc-50 p-4"><Building2 size={32} className="text-zinc-300" aria-hidden="true" /></div>
          <h2 className="text-base font-semibold text-zinc-800">{search || showInactive ? "No encontramos sedes" : "Aún no hay sedes registradas"}</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-500">{search || showInactive ? "Prueba con otra búsqueda o restablece los filtros." : "Crea la primera sede para comenzar a administrarla."}</p>
          <button type="button" onClick={search || showInactive ? clearFilters : openCreate} className="mt-5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">{search || showInactive ? "Restablecer filtros" : "+ Nueva sede"}</button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => <BranchCard key={branch._id} branch={branch} busy={busyId === branch._id} onEdit={() => openEdit(branch)} onDelete={() => handleDelete(branch)} onReactivate={() => handleReactivate(branch)} />)}
        </div>
      ) : (
      <DataTable
        loading={loading}
        rows={branches}
        emptyMessage="No hay sedes registradas todavía"
        columns={[
          { key: "name", label: "Nombre" },
          { key: "address", label: "Dirección" },
          { key: "phone", label: "Teléfono", hideOnMobile: true },
          {
            // NIT de la sede — antes era una constante global hardcodeada en
            // el recibo y el ticket térmico, ahora es un dato de la sede
            // (`Branch.nit`). El backend lo devuelve en cada fila sin
            // populate (es campo top-level del documento Branch). Una sede
            // sin NIT (sedes preexistentes que aún no se han editado) muestra
            // "—" en vez de un campo vacío, para que la columna no se
            // confunda con celdas vacías de "no hay dato".
            key: "nit",
            label: "NIT",
            hideOnMobile: true,
            render: (r) => (
              <span className={r.nit ? "text-neutral-700" : "text-neutral-400"}>
                {r.nit || "—"}
              </span>
            ),
          },
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
                  aria-label={`Editar ${r.name}`}
                  onClick={() => openEdit(r)}
                  className="text-brand-600 hover:underline text-xs font-medium"
                >
                  <SquarePen size={20} />
                </button>
                {r.status ? (
                  <button
                    aria-label={`Eliminar ${r.name}`}
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
      )}

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
