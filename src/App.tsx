import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Layout from "./layout/Layout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { AuthProvider, useAuthSession } from "./components/AuthProvider";

// Cargadas perezosamente (`React.lazy`, ver punto 42 de
// admin-frontend/CLAUDE.md) — antes eran imports estáticos, así que TODAS
// terminaban en el mismo bundle de ~1MB que hasta `/login` tenía que
// descargar completo antes de poder mostrar nada. Con esto, cada página
// es su propio chunk que Vite solo pide cuando esa ruta se visita de
// verdad.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sedes = lazy(() => import("./pages/Sedes"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Compras = lazy(() => import("./pages/Compras"));
const Ventas = lazy(() => import("./pages/Ventas"));
const CuentasPorPagar = lazy(() => import("./pages/CuentasPorPagar"));
const CuentasPorCobrar = lazy(() => import("./pages/CuentasPorCobrar"));
const Gastos = lazy(() => import("./pages/Gastos"));
const Personal = lazy(() => import("./pages/Personal"));
const DianConfig = lazy(() => import("./pages/DianConfig"));
const FinanzasCaja = lazy(() => import("./pages/FinanzasCaja"));
const FinanzasReportes = lazy(() => import("./pages/FinanzasReportes"));

import RequireCashierAuth from "./cajero/components/RequireCashierAuth";
import CashierLayout from "./cajero/layout/CashierLayout";

const Caja = lazy(() => import("./cajero/pages/Caja"));
const Facturas = lazy(() => import("./cajero/pages/Facturas"));
const ComprasCajero = lazy(() => import("./cajero/pages/Compras"));

/**
 * Decide a dónde mandar "/" según qué sesión activa exista — ahora solo
 * LEE el resultado ya calculado por `<AuthProvider>` (ver
 * components/AuthProvider.tsx) en vez de volver a consultar `/me` por su
 * cuenta, que era el diseño anterior. `/` no es una página real (nadie le
 * pone contenido), así que igual sigue esperando a que el chequeo
 * termine antes de decidir — a diferencia de `/login`, acá no hay nada
 * que "renderizar de inmediato".
 */
function RootRedirect() {
  const { status, admin, cashier } = useAuthSession();

  if (status === "checking") {
    return (
      <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm">
        Cargando...
      </div>
    );
  }

  if (admin) return <Navigate to="/dashboard" replace />;
  if (cashier) return <Navigate to="/cajero/caja" replace />;
  return <Navigate to="/login" replace />;
}

// Fallback de `<Suspense>` mientras se descarga el chunk de una página
// perezosa — mismo look que las pantallas de "Cargando..."/"Verificando
// sesión..." que ya existían (RequireAuth, RequireRole, etc.), para que
// no se sienta como un estado distinto. En una red rápida esto ni
// alcanza a pintarse (el chunk ya está en caché del navegador tras la
// primera visita a esa ruta).
function RouteLoadingFallback() {
  return (
    <div className="h-dvh w-screen flex items-center justify-center text-neutral-400 text-sm">
      Cargando...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Área Administrador */}
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/sedes"
                element={
                  <RequireRole roles={["ADMIN"]}>
                    <Sedes />
                  </RequireRole>
                }
              />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/compras" element={<Compras />} />
              <Route path="/ventas" element={<Ventas />} />
              <Route path="/cuentas-por-pagar" element={<CuentasPorPagar />} />
              <Route path="/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route
                path="/personal"
                element={
                  <RequireRole roles={["ADMIN"]}>
                    <Personal />
                  </RequireRole>
                }
              />
              <Route path="/dian-config" element={<DianConfig />} />
              <Route path="/finanzas" element={<Navigate to="/finanzas/caja" replace />} />
              <Route path="/finanzas/caja" element={<FinanzasCaja />} />
              <Route path="/finanzas/reportes" element={<FinanzasReportes />} />
            </Route>

            {/* Área Cajero */}
            <Route
              path="/cajero"
              element={
                <RequireCashierAuth>
                  <CashierLayout />
                </RequireCashierAuth>
              }
            >
              <Route index element={<Navigate to="caja" replace />} />
              <Route path="caja" element={<Caja />} />
              <Route path="facturas" element={<Facturas />} />
              <Route path="compras" element={<ComprasCajero />} />
            </Route>

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
