import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { adminApi } from "../services/api";
import { useAuthSession } from "../components/AuthProvider";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/sedes": "Sedes",
  "/inventario": "Inventario",
  "/compras": "Compras",
  "/ventas": "Ventas",
  "/cuentas-por-pagar": "Cuentas por Pagar",
  "/cuentas-por-cobrar": "Cuentas por Cobrar",
  "/gastos": "Gastos",
  "/personal": "Personal",
  "/dian-config": "Configuración DIAN",
  "/finanzas/caja": "Finanzas — Caja",
  "/finanzas/reportes": "Finanzas — Reportes",
};

/** Sede seleccionada globalmente, expuesta vía contexto simple (localStorage + evento) */
export function useSelectedBranch() {
  const [branchId, setBranchId] = useState(localStorage.getItem("admin_selected_branch") || "");

  const update = (id: string) => {
    localStorage.setItem("admin_selected_branch", id);
    setBranchId(id);
    window.dispatchEvent(new Event("mecatos:branch-changed"));
  };

  useEffect(() => {
    const handler = () => setBranchId(localStorage.getItem("admin_selected_branch") || "");
    window.addEventListener("mecatos:branch-changed", handler);
    return () => window.removeEventListener("mecatos:branch-changed", handler);
  }, []);

  return [branchId, update] as const;
}

export default function Layout() {
  const location = useLocation();
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useSelectedBranch();
  // Perfil del admin/gerente — viene del chequeo único que hace
  // `<AuthProvider>` al montar la app (ver components/AuthProvider.tsx),
  // no de una llamada propia a `adminApi.me()`. Por eso `Layout` solo se
  // monta cuando `RequireAuth` ya confirmó que `admin` existe (ver
  // App.tsx) — no hace falta un estado "cargando" acá.
  const { admin } = useAuthSession();
  // Solo importa en móvil (`< md`) — en desktop el Sidebar siempre está
  // visible y estas props no hacen nada, ver Sidebar.tsx.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cerrar el drawer al navegar — si no, cambiar de página con el menú
  // abierto lo dejaría tapando la pantalla en la nueva ruta.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    adminApi
      .listBranches({ pageSize: 100 })
      .then((res) => setBranches(res.data))
      .catch(() => setBranches([]));
  }, []);

  // Un gerente de sede siempre queda fijado a su propia sede — se fuerza
  // acá por si el selector quedó en "todas las sedes" (o en otra sede) de
  // una sesión anterior como administrador en el mismo navegador. El
  // backend igual lo exige sin importar lo que mande el frontend (ver
  // resolveBranchFilter en adminController.ts). `admin` solo cambia una
  // vez por sesión (lo fija `<AuthProvider>` al resolver el chequeo o
  // justo después de un login exitoso), así que no hace falta
  // `setSelectedBranch` en las dependencias — evita un loop si esa
  // función no fuera estable entre renders.
  useEffect(() => {
    if (admin?.role === "MANAGER" && admin.branchId) {
      setSelectedBranch(String(admin.branchId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const isManager = admin?.role === "MANAGER";
  const lockedBranchName = isManager
    ? branches.find((b) => b._id === admin?.branchId)?.name
    : undefined;

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-neutral-50">
      <Sidebar
        name={admin?.name}
        role={admin?.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          title={TITLES[location.pathname] || "Mecatos el Santi"}
          branches={branches}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          lockedBranchName={lockedBranchName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
