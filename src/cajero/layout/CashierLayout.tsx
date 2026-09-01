import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { usePosStore } from "../store/posStore";
import { posApi } from "../services/posApi";
import { syncPendingSales } from "../services/syncService";
import { ReceiptText, ShoppingCart, Wallet } from "lucide-react";
import ShiftModal from "../components/modals/ShiftModal";
import MobileBlockScreen from "../components/MobileBlockScreen";
import { useAuthSession } from "../../components/AuthProvider";

const tabs = [
  { to: "/cajero/caja", label: "Caja", icon: <Wallet color="#ffffff" size={20}/> },
  { to: "/cajero/compras", label: "Compras", icon: <ShoppingCart color="#ffffff" size={20} /> },
];

{/** to: "/cajero/facturas", label: "Facturas", icon: <ReceiptText color="#ffffff" size={20} />**/}

// Los cajeros solo trabajan desde el computador de la caja (ver punto 36
// de admin-frontend/CLAUDE.md) — a diferencia del `useIsMobile()` de
// Dashboard.tsx (que decide qué widgets montar), acá la única acción es
// bloquear TODA la zona de cajero con `MobileBlockScreen`, así que un
// simple `matchMedia` sin re-render condicional de contenido complejo
// alcanza. Mismo breakpoint (767px) para no introducir un umbral nuevo.
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

export default function CashierLayout() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { clearAuthSession } = useAuthSession();
  const setSession = usePosStore((s) => s.setSession);
  const clearSession = usePosStore((s) => s.clearSession);
  const branchName = usePosStore((s) => s.branchName);
  const cashierName = usePosStore((s) => s.cashierName);
  const setShiftId = usePosStore((s) => s.setShiftId);
  const activeModal = usePosStore((s) => s.activeModal);
  const openModal = usePosStore((s) => s.openModal);

  // Verifica contra el servidor si el cajero ya tiene un turno abierto —
  // nunca se asume por localStorage (ver punto 30 de CLAUDE.md). Se hace
  // acá (no en cada página) porque las 3 pestañas del cajero necesitan
  // saberlo: Caja/Facturas/Compras muestran `ShiftRequiredNotice` en vez
  // de sus datos reales mientras no haya turno, pero la navegación entre
  // pestañas y el botón "Salir" siguen disponibles siempre — a diferencia
  // del overlay bloqueante anterior (ver punto 32), esto ya NO impide
  // moverse por la app, solo oculta datos operativos hasta que se abre un
  // turno. `ShiftModal` NO se abre solo con este resultado — el cajero lo
  // abre a propósito con el botón "Iniciar turno" de `ShiftRequiredNotice`
  // o el ícono 🧾 de `PaymentPanel`.
  useEffect(() => {
    posApi
      .getCurrentShift()
      .then((res) => setShiftId(res.shiftId))
      .catch(() => setShiftId(null));
  }, [setShiftId]);

  // Hidrata el store de Zustand consultando al backend (GET /auth/me), que
  // valida la cookie httpOnly del lado del servidor. El store en memoria se
  // pierde en un refresh de página; la cookie no, así que esto reconstruye
  // el estado de sesión sin necesitar nada en localStorage.
  useEffect(() => {
    posApi
      .me()
      .then((session) => {
        setSession({
          branchId: session.branchId,
          branchName: session.branchName,
          cashierId: session.cashierId,
          cashierName: session.name,
        });
        // Reintenta sincronizar ventas offline pendientes de sesiones anteriores
        syncPendingSales();
      })
      .catch(() => navigate("/login", { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      await posApi.logout();
    } catch {
      // aunque falle la llamada, igual limpiamos el estado local y navegamos
    }
    clearSession();
    // Este logout navega con React Router (`navigate`, no recarga la
    // página) — a diferencia del logout del admin (`Sidebar.tsx`), que sí
    // fuerza `window.location.href` y por eso reinicia solo el estado
    // compartido de `<AuthProvider>` desde cero al recargar. Acá hay que
    // limpiarlo a mano: si no, `cashier` seguiría teniendo el perfil viejo
    // en memoria y `Login.tsx` (que redirige lejos de /login apenas ve una
    // sesión "autenticada") rebotaría de inmediato de vuelta a
    // /cajero/caja, dejando al cajero sin forma real de cerrar sesión.
    clearAuthSession();
    navigate("/login");
  };

  if (isMobile) {
    return <MobileBlockScreen onLogout={logout} />;
  }

  return (
    <div className="h-dvh w-screen flex flex-col overflow-hidden bg-white">
      <header className="relative h-14 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-bold text-sm">Mecatos el Santi</span>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-600 text-white" : "text-neutral-300 hover:bg-neutral-800"
                  }`
                }
              >
                <span>{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Mismo look que el botón "Iniciar turno" de `ShiftRequiredNotice`
            (degradé de marca), centrado en el header — antes vivía como un
            ícono 🧾 discreto en `PaymentPanel`, pero cerrar turno es una
            acción que debería ser igual de visible que abrirlo. Abre el
            mismo `ShiftModal` que ya maneja apertura Y cierre; solo cambia
            el texto/estilo de este disparador. */}
        <button
          onClick={() => openModal("SHIFT")}
          title="Cerrar turno"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white font-bold text-sm px-5 py-2 rounded-xl shadow-lg shadow-brand-900/40 transition-all"
        >
          Finalizar turno
        </button>

        <div className="flex items-center gap-3 text-xs text-neutral-300">
          <span>
            {branchName} · {cashierName}
          </span>
          <button
            onClick={logout}
            className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg text-white"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {activeModal === "SHIFT" && <ShiftModal />}
    </div>
  );
}
