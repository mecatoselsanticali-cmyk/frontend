import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { adminApi } from "../services/api";

/**
 * Como el token vive en una cookie httpOnly, el frontend no puede leerlo
 * para saber "¿hay sesión?" — en su lugar, le pregunta al backend
 * (GET /auth/me), que valida la cookie del lado del servidor. Por eso esta
 * guarda es asíncrona con un estado de carga intermedio.
 */
export default function RequireAuth({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<"loading" | "authed" | "unauthed">("loading");

  useEffect(() => {
    adminApi
      .me()
      .then(() => setStatus("authed"))
      .catch(() => setStatus("unauthed"));
  }, []);

  if (status === "loading") {
    return (
      <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm">
        Verificando sesión...
      </div>
    );
  }

  if (status === "unauthed") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
