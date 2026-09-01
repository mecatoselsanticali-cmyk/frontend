import { Navigate } from "react-router-dom";
import { useAuthSession } from "./AuthProvider";

/**
 * Segunda barrera (además de ocultar el link en Sidebar.tsx) para rutas que
 * un GERENTE no debería poder abrir ni por URL directa — hoy solo /sedes y
 * /personal. Ya se llegó aquí a través de `RequireAuth` (hay sesión válida),
 * así que esto solo verifica el rol, no la autenticación — lee el mismo
 * estado compartido de `<AuthProvider>` en vez de volver a llamar a
 * `adminApi.me()` por su cuenta (que era el diseño anterior).
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: JSX.Element;
}) {
  const { status, admin } = useAuthSession();

  if (status === "checking") {
    return (
      <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm">
        Verificando sesión...
      </div>
    );
  }

  // `!admin` acá en la práctica nunca debería pasar (RequireAuth, más
  // arriba en el árbol de rutas, ya garantizó que hay sesión admin) — se
  // deja como red de seguridad, con el mismo destino que "rol no
  // permitido" tenía antes de este cambio.
  if (!admin || !roles.includes(admin.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
