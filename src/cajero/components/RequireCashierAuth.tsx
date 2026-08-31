import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { posApi } from "../services/posApi";

/**
 * Igual que RequireAuth pero para la cookie httpOnly `cashier_token` —
 * verifica contra GET /api/pos/auth/me en vez de leer localStorage.
 */
export default function RequireCashierAuth({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<"loading" | "authed" | "unauthed">("loading");

  useEffect(() => {
    posApi
      .me()
      .then(() => setStatus("authed"))
      .catch(() => setStatus("unauthed"));
  }, []);

  if (status === "loading") {
    return (
      <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm bg-neutral-900">
        Verificando sesión...
      </div>
    );
  }

  if (status === "unauthed") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
