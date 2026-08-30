import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { adminApi } from "../services/api";

/**
 * Segunda barrera (además de ocultar el link en Sidebar.tsx) para rutas que
 * un GERENTE no debería poder abrir ni por URL directa — hoy solo /sedes y
 * /personal. Ya se llegó aquí a través de `RequireAuth` (hay sesión válida),
 * así que esto solo verifica el rol, no la autenticación.
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: JSX.Element;
}) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    adminApi
      .me()
      .then((me) => setStatus(roles.includes(me.role) ? "allowed" : "denied"))
      .catch(() => setStatus("denied"));
  }, []);

  if (status === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-neutral-400 text-sm">
        Verificando sesión...
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
