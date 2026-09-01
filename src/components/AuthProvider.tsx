import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { adminApi } from "../services/api";
import { posApi } from "../cajero/services/posApi";

export type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export interface AdminProfile {
  id: string;
  name: string;
  role: string;
  branchId?: string;
}

export interface CashierProfile {
  id: string;
  name: string;
}

interface AuthSessionValue {
  status: AuthStatus;
  admin: AdminProfile | null;
  cashier: CashierProfile | null;
  /** Actualiza el estado compartido con el perfil que ya devolvió
   * `POST /auth/login` — evita otro viaje a `/me` justo después de loguearse,
   * ya que el login ya trae los datos que necesitamos. */
  setAdminSession: (profile: AdminProfile) => void;
  setCashierSession: (profile: CashierProfile) => void;
  /** Para logout — ver el comentario sobre `CashierLayout.tsx` más abajo:
   * necesario en cualquier logout que navegue con React Router en vez de
   * recargar la página completa, para que este estado no quede
   * desactualizado apuntando a una sesión que el backend ya cerró. */
  clearAuthSession: () => void;
}

const AuthContext = createContext<AuthSessionValue | null>(null);

/**
 * Único punto donde se decide "¿hay sesión activa, y de qué tipo?" —
 * antes esto se calculaba por separado en `RootRedirect`, `RequireAuth`,
 * `RequireRole` y `Layout.tsx` (los cuatro llamaban a `adminApi.me()` de
 * forma independiente, cada uno con su propio `useEffect`), así que una
 * sola carga de página con sesión admin activa podía disparar hasta 4
 * peticiones idénticas a `GET /api/admin/auth/me` antes de terminar de
 * pintar el dashboard. Ahora ese chequeo corre UNA sola vez acá (al
 * montar `<AuthProvider>`, que envuelve toda la app en `App.tsx`) y todo
 * lo demás solo LEE el resultado vía `useAuthSession()`.
 *
 * Sigue el mismo orden que ya tenía `RootRedirect` (admin primero, cajero
 * como fallback si admin falla) — un navegador normalmente solo tiene una
 * de las dos cookies de sesión activa a la vez, así que no hace falta
 * consultar ambas rutas en paralelo.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [cashier, setCashier] = useState<CashierProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const me = await adminApi.me();
        if (cancelled) return;
        setAdmin({ id: me.id, name: me.name, role: me.role, branchId: me.branchId });
        setCashier(null);
        setStatus("authenticated");
        return;
      } catch {
        // sin sesión admin, seguimos probando con la de cajero
      }
      try {
        const me = await posApi.me();
        if (cancelled) return;
        setCashier({ id: me.cashierId, name: me.name });
        setStatus("authenticated");
        return;
      } catch {
        // sin ninguna sesión activa — estado normal para alguien que
        // todavía no inició sesión, no es un error que haya que mostrar
      }
      if (!cancelled) setStatus("unauthenticated");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAdminSession = (profile: AdminProfile) => {
    setAdmin(profile);
    setCashier(null);
    setStatus("authenticated");
  };

  const setCashierSession = (profile: CashierProfile) => {
    setCashier(profile);
    setAdmin(null);
    setStatus("authenticated");
  };

  const clearAuthSession = () => {
    setAdmin(null);
    setCashier(null);
    setStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider
      value={{ status, admin, cashier, setAdminSession, setCashierSession, clearAuthSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthSession debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
