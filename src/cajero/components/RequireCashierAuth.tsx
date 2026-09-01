import { Navigate } from "react-router-dom";
import { useAuthSession } from "../../components/AuthProvider";

/**
 * Igual que RequireAuth pero para la cookie httpOnly `cashier_token` — lee
 * el mismo estado compartido de `<AuthProvider>` (ver
 * components/AuthProvider.tsx) en vez de llamar a `posApi.me()` por su
 * cuenta.
 *
 * **Excepción deliberada a la regla de aislamiento del punto 12** ("nunca
 * importar entre `src/cajero/` y el resto de la app, salvo `Login.tsx`") —
 * `AuthProvider` es, como `Login.tsx`, un archivo de nivel de "app shell"
 * (vive fuera de `src/cajero/` mismo por eso), no lógica de negocio del
 * POS — el gating de auth es infraestructura compartida por diseño, igual
 * que `Login.tsx` ya cruza esa frontera para `posApi`. Sin esto, cada
 * carga de `/cajero/*` volvía a llamar a `posApi.me()` por su cuenta
 * ADEMÁS del chequeo que `<AuthProvider>` ya hace al montar la app — un
 * segundo caso del mismo problema de duplicación que motivó todo este
 * cambio (ver punto 42 de admin-frontend/CLAUDE.md).
 *
 * `CashierLayout.tsx` (lo que este componente renderiza una vez
 * confirmada la sesión) SÍ sigue haciendo su propia llamada a
 * `posApi.me()` — pero es para hidratar el store de Zustand con
 * branchId/branchName/loginAt (datos que este chequeo de solo-gating no
 * tiene), no para verificar la sesión de nuevo; ese sí queda fuera del
 * alcance de este cambio.
 */
export default function RequireCashierAuth({ children }: { children: JSX.Element }) {
  const { status, cashier } = useAuthSession();

  if (status === "checking") {
    return (
      <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm bg-neutral-900">
        Verificando sesión...
      </div>
    );
  }

  if (!cashier) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
