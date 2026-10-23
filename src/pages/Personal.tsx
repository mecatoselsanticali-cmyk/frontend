import KpiCarousel from "../components/KpiCarousel";
import { useEffect, useState } from "react";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import UserModal from "../components/UserModal";
import ActionsMenu from "../components/ActionsMenu";
import { useAuthSession } from "../components/AuthProvider";
import Swal from "sweetalert2";
import { Search, ShieldCheck, Mail, Plus, Users, UserCheck, type LucideIcon } from "lucide-react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente de sede",
  CASHIER: "Cajero",
};

interface TeamUser {
  _id: string;
  name: string;
  role: string;
  email?: string;
  branchId?: string;
  branchName?: string;
  active: boolean;
}

const roleColors: Record<string, string> = {
  ADMIN: "bg-orange-50 text-orange-700 border-orange-200/60",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200/60",
  CASHIER: "bg-zinc-100 text-zinc-700 border-zinc-200/60",
};

function RoleBadge({ role }: { role: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${roleColors[role] || roleColors.CASHIER}`}>{roleLabels[role] || role}</span>;
}

function UserIdentity({ user }: { user: TeamUser }) {
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
  return <div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700">{initials || "U"}</span><span className="font-medium text-zinc-900">{user.name}</span></div>;
}

function TeamKpi({ label, value, icon: Icon, loading, children }: {
  label: string; value: string; icon: LucideIcon; loading: boolean; children?: React.ReactNode;
}) {
  return <section aria-busy={loading} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-medium text-zinc-500">{label}</h2><Icon size={19} className="text-orange-500" aria-hidden="true" /></div><p className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">{loading ? "…" : value}</p>{!loading && children && <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">{children}</div>}</section>;
}

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
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [focusCredentials, setFocusCredentials] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const { admin } = useAuthSession();
  const currentUserId = admin?.id ? String(admin.id) : null;
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [revision, setRevision] = useState(0);
  const pageSize = isMobile ? 5 : 20;

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(false);
    const collect = async () => {
      const all: TeamUser[] = [];
      let currentPage = 1;
      let lastPage = 1;
      do {
        const result = await adminApi.listUsers({ branchId: selectedBranch || undefined, includeInactive: true, page: currentPage, pageSize: 100 });
        if (cancelled) return;
        all.push(...result.data);
        lastPage = result.totalPages;
        currentPage += 1;
      } while (currentPage <= lastPage);
      setTeam(all);
    };
    collect().catch(() => { if (!cancelled) setSummaryError(true); }).finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBranch, revision]);
  const activeCount = team.filter((user) => user.active).length;
  const roleCounts = team.reduce<Record<string, number>>((counts, user) => { counts[user.role] = (counts[user.role] || 0) + 1; return counts; }, {});

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

  const refresh = () => { load(); setRevision((value) => value + 1); };

  useEffect(load, [selectedBranch, showInactive, role, search, page, isMobile]);

  // Cambiar de sede, rol, búsqueda o el filtro de inactivos debe volver a
  // la página 1 — si no, se podría quedar en una página que ya no existe
  // para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [selectedBranch, showInactive, role, search]);

   const openCreate = () => {
      setFocusCredentials(false);
      setEditingUser(null);
      setModalOpen(true);
    };
  
    const openEdit = (user: TeamUser, credentials = false) => {
      setFocusCredentials(credentials);
      setEditingUser(user);
      setModalOpen(true);
    };
  
    const handleDelete = async (user: any) => {
        const result = await Swal.fire({
          title: `¿Desactivar "${user.name}"?`,
          text: "El usuario quedará inactivo. Se puede reactivar despues.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Desactivar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#a3a3a3",
        });
        if (!result.isConfirmed) return;
    
        setBusyId(user._id);
        try {
          await adminApi.updateUser(user._id, { active: false });
          refresh();
          Swal.fire({ title: "Usuario desactivado", icon: "success", timer: 1500, showConfirmButton: false });
        } catch (err: any) {
          Swal.fire({ title: "Error", text: err.message || "No se pudo desactivar el usuario", icon: "error" });
        } finally {
          setBusyId(null);
        }
      };

      const handleReactivate = async (user: any) => {
          setBusyId(user._id);
          try {
            await adminApi.updateUser(user._id, { active: true });
            refresh();
            Swal.fire({ title: "Usuario reactivado", icon: "success", timer: 1500, showConfirmButton: false });
          } catch (err: any) {
            Swal.fire({ title: "Error", text: err.message || "No se pudo reactivar el usuario", icon: "error" });
          } finally {
            setBusyId(null);
          }
        };

  const clearFilters = () => {
    setSearch("");
    setRole("");
    setShowInactive(false);
  };

  return (
    <div className="space-y-4">
      <KpiCarousel label="Métricas de personal">
        <TeamKpi label="Total Usuarios Registrados" value={summaryError ? "—" : `${team.length} colaboradores`} icon={Users} loading={summaryLoading} />
        <TeamKpi label="Desglose por Rol" value={summaryError ? "—" : `${Object.keys(roleCounts).length} roles`} icon={ShieldCheck} loading={summaryLoading}>{!summaryError && Object.entries(roleLabels).map(([value, label]) => <span key={value} className="rounded-lg bg-zinc-50 px-2 py-1">{roleCounts[value] || 0} · {label}</span>)}</TeamKpi>
        <TeamKpi label="Usuarios Activos vs Inactivos" value={summaryError ? "—" : `${activeCount} activos`} icon={UserCheck} loading={summaryLoading}>{!summaryError && <span>{team.length - activeCount} inactivos</span>}</TeamKpi>
      </KpiCarousel>
      <p className="text-xs text-zinc-400">Resumen de todos los usuarios de {selectedBranch ? "la sede seleccionada" : "la organización"}, incluidos los inactivos.</p>
      {summaryError && <p role="alert" className="text-xs text-red-600">No se pudo cargar el resumen. <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Reintentar</button></p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <div className="relative min-w-0 flex-1 md:min-w-56"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" /><input aria-label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></div>
          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-zinc-400"><ShieldCheck size={17} className="shrink-0" aria-hidden="true" /><select aria-label="Filtrar por rol" value={role} onChange={(event) => setRole(event.target.value)} className="min-w-0 w-full bg-white text-sm text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><option value="">Todos los roles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-500"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-orange-600" />Mostrar Inactivos</label>
          {(search || role || showInactive) && <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50">Limpiar filtros</button>}
        </div>
        <button type="button" onClick={openCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:w-auto"><Plus size={17} aria-hidden="true" />Nuevo usuario</button>
      </div>
      <DataTable
        loading={loading}
        rows={users}
        emptyMessage="No hay usuarios registrados para esta sede"
        columns={[
          { key: "name", label: "Nombre", render: (r) => <UserIdentity user={r} /> },
          { key: "role", label: "Rol", render: (r) => <RoleBadge role={r.role} /> },
          { key: "email", label: "Correo", hideOnMobile: true, render: (r) => r.email ? <span className="flex items-center gap-2 text-zinc-500"><Mail size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />{r.email}</span> : <span className="text-xs text-zinc-400">Sin correo registrado</span> },
          {
            key: "active",
            label: "Estado",
            render: (r) => (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border ${
                  r.active ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-zinc-100 text-zinc-500 border-zinc-200/60"
                }`}
              >
                {r.active ? "Activo" : "Inactivo"}
              </span>
            ),
          },
          { key: "branchName", label: "Sede", render: (r) => <span title={r.branchName || undefined} className="inline-flex whitespace-nowrap rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{r.branchName && r.branchName !== "—" ? r.branchName.replace(/^Mecatos\s+el\s+Santi\s*[-–—:]?\s*/i, "") || r.branchName : r.role === "ADMIN" ? "Acceso Global / Nivel Central" : "Sin sede asignada"}</span> },
          { key: "Acciones", label: "Acciones", stickyRight: true, centerHeader: true, render: (r) => {
            const isSelf = currentUserId !== null && String(r._id) === currentUserId;
            return (
            <div className="flex justify-center">
              <ActionsMenu items={[
                { label: "Editar permisos", disabled: busyId === r._id, onClick: () => openEdit(r) },
                { label: r.role === "CASHIER" ? "Cambiar PIN" : "Cambiar clave", disabled: busyId === r._id, onClick: () => openEdit(r, true) },
                ...(!isSelf ? [r.active
                  ? { label: "Desactivar usuario", danger: true, disabled: busyId === r._id, onClick: () => handleDelete(r) }
                  : { label: "Reactivar usuario", disabled: busyId === r._id, onClick: () => handleReactivate(r) }] : []),
              ]} />
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
          focusCredentials={focusCredentials}
          initialBranchId={selectedBranch || undefined}
          onClose={() => setModalOpen(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
