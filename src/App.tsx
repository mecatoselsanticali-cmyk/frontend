import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Layout from "./layout/Layout";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { adminApi } from "./services/api";
import Dashboard from "./pages/Dashboard";
import Sedes from "./pages/Sedes";
import Inventario from "./pages/Inventario";
import Compras from "./pages/Compras";
import Ventas from "./pages/Ventas";
import CuentasPorPagar from "./pages/CuentasPorPagar";
import CuentasPorCobrar from "./pages/CuentasPorCobrar";
import Gastos from "./pages/Gastos";
import Personal from "./pages/Personal";
import DianConfig from "./pages/DianConfig";
import FinanzasCaja from "./pages/FinanzasCaja";
import FinanzasReportes from "./pages/FinanzasReportes";

import RequireCashierAuth from "./cajero/components/RequireCashierAuth";
import CashierLayout from "./cajero/layout/CashierLayout";
import { posApi } from "./cajero/services/posApi";
import Caja from "./cajero/pages/Caja";
import Facturas from "./cajero/pages/Facturas";
import ComprasCajero from "./cajero/pages/Compras";

/**
 * Decide a dónde mandar "/" según qué sesión activa exista. Como el token
 * vive en una cookie httpOnly (no en localStorage), no podemos saber esto
 * de forma síncrona — hay que preguntarle al backend. Se consulta primero
 * /api/admin/auth/me y, si no hay sesión admin, /api/pos/auth/me.
 */
function RootRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      try {
        await adminApi.me();
        if (!cancelled) setTarget("/dashboard");
        return;
      } catch {
        // sin sesión admin, seguimos probando con la de cajero
      }
      try {
        await posApi.me();
        if (!cancelled) setTarget("/cajero/caja");
        return;
      } catch {
        // sin ninguna sesión activa
      }
      if (!cancelled) setTarget("/login");
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-neutral-400 text-sm">
        Cargando...
      </div>
    );
  }

  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
