import { Navigate } from "react-router-dom";
import { useAuthSession } from "./AuthProvider";

/**
 * Como el token vive en una cookie httpOnly, el frontend no puede leerlo
 * para saber "¿hay sesión?" — en su lugar, le pregunta al backend
 * (GET /auth/me), que valida la cookie del lado del servidor. Ya no hace
 * esa consulta por su cuenta: lee el resultado del chequeo único que hace
 * `<AuthProvider>` al montar la app (ver components/AuthProvider.tsx) —
 * antes este componente tenía su propio `useEffect` con `adminApi.me()`,
 * uno de los hasta 4 sitios que llamaban al mismo endpoint por separado.
 */
export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { status, admin } = useAuthSession();

  if (status === "checking") {
    return (
      <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm">
        Verificando sesión...
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
