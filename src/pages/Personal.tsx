import { useEffect, useState } from "react";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import UserModal from "../components/UserModal";
import MoreFiltersModal from "../components/MoreFiltersModal";
import Swal from "sweetalert2";
import { SquarePen, Trash2 } from "lucide-react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente de sede",
  CASHIER: "Cajero",
};

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

export default function Personal() {
  const isMobile = useIsMobile();
  const [selectedBranch] = useSelectedBranch(); // filtro de la tabla (barra superior)
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Modal "Más filtros" de la vista de celular (ver punto 63 de CLAUDE.md)
  // — solo `search` queda visible fuera del modal; "Rol"/"Mostrar
  // inactivos" viven adentro.
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const pageSize = isMobile ? 5 : 20;

  // Para ocultar el botón de "eliminar" en la propia fila del admin
  // logueado — no puede desactivar su propia cuenta (ver adminController.updateUser).
  useEffect(() => {
    adminApi.me().then((me) => setCurrentUserId(String(me.id)));
  }, []);

  const load = () => {
    setLoading(true);
    adminApi
      .listUsers({
        branchId: selectedBranch || undefined,
        includeInactive: showInactive,
        role: role || undefined,
        search: search.trim() || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setUsers(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
        // Si una eliminación dejó la página actual vacía, retrocede a la
        // última página real (mismo patrón que Inventario.tsx).
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch, showInactive, role, search, page, isMobile]);

  // Cambiar de sede, rol, búsqueda o el filtro de inactivos debe volver a
  // la página 1 — si no, se podría quedar en una página que ya no existe
  // para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [selectedBranch, showInactive, role, search]);

   const openCreate = () => {
      setEditingUser(null);
      setModalOpen(true);
    };
  
    const openEdit = (user: any) => {
      setEditingUser(user);
      setModalOpen(true);
    };
  
    const handleDelete = async (user: any) => {
        const result = await Swal.fire({
          title: `¿Eliminar "${user.name}"?`,
          text: "El usuario quedará inactivo. Se puede reactivar despues.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Eliminar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#a3a3a3",
        });
        if (!result.isConfirmed) return;
    
        setBusyId(user._id);
        try {
          await adminApi.updateUser(user._id, { ...user, active: false });
          load();
          Swal.fire({ title: "Usuario eliminado", icon: "success", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
          Swal.fire({ title: "Error", text: err.message || "No se pudo eliminar el usuario", icon: "error" });
        } finally {
          setBusyId(null);
        }
      };

      const handleReactivate = async (user: any) => {
          setBusyId(user._id);
          try {
            await adminApi.updateUser(user._id, { active: true });
            load();
            Swal.fire({ title: "Usuario reactivado", icon: "success", timer: 1500, showConfirmButton: false });
          } catch (err: any) {
            Swal.fire({ title: "Error", text: err.message || "No se pudo reactivar el usuario", icon: "error" });
          } finally {
            setBusyId(null);
          }
        };

  const extraFiltersCount = [role, showInactive].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {!isMobile && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-neutral-500 text-sm">Empleados y administradores</h3>
            <input
              placeholder="Buscar por nombre o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm w-full sm:w-64"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Rol: todos</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostrar inactivos
            </label>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto shrink-0"
          >
            + Nuevo usuario
          </button>
        </div>
      )}

      {/* Vista de celular (ver punto 63 de CLAUDE.md) — solo el buscador
          queda visible junto al botón "Más filtros"; "Rol"/"Mostrar
          inactivos" viven en el modal. */}
      {isMobile && (
        <>
          <div className="flex gap-2">
            <input
              placeholder="Buscar por nombre o correo..."
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
            + Nuevo usuario
          </button>
        </>
      )}

      {filtersModalOpen && (
        <MoreFiltersModal onClose={() => setFiltersModalOpen(false)}>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </MoreFiltersModal>
      )}

      <DataTable
        loading={loading}
        rows={users}
        emptyMessage="No hay usuarios registrados para esta sede"
        columns={[
          { key: "name", label: "Nombre" },
          { key: "role", label: "Rol", render: (r) => roleLabels[r.role] },
          { key: "email", label: "Correo", hideOnMobile: true, render: (r) => r.email || "—" },
          {
            key: "active",
            label: "Estado",
            render: (r) => (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  r.active ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {r.active ? "Activo" : "Inactivo"}
              </span>
            ),
          },
          { key: "branchName", label: "Sede", render: (r) => r.branchName || "—" },
          { key: "Acciones", label: "Acciones", stickyRight: true, centerHeader: true, render: (r) => {
            const isSelf = currentUserId !== null && String(r._id) === currentUserId;
            return (
            <div className="flex justify-center gap-3">
                <button
                  onClick={() => openEdit(r)}
                  className="text-brand-600 hover:underline text-xs font-medium"
                >
                  <SquarePen size={20} />
                </button>
                {/* Un admin no puede desactivar su propia cuenta — ver
                    adminController.updateUser, que también lo rechaza del
                    lado del servidor si esto se saltara. */}
                {!isSelf && (
                  r.active ? (
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
                  )
                )}
              </div>
            );
          }},
        ]}
      />

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} usuario{total === 1 ? "" : "s"} · página {page} de {totalPages}
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
        <UserModal
          user={editingUser || undefined}
          initialBranchId={selectedBranch || undefined}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
