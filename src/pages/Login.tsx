import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../services/api";
import { posApi } from "../cajero/services/posApi";
import { AuthShell, GlassCard, BackButton } from "../components/AuthShell";
import { useAuthSession } from "../components/AuthProvider";
import {
  Delete,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPinHouse,
  Receipt,
  ShieldCheck,
} from "lucide-react";

type Mode = "CHOOSE" | "ADMIN" | "FORGOT_PASSWORD" | "CASHIER_BRANCH" | "CASHIER_PIN";

interface Branch {
  _id: string;
  name: string;
  address: string;
}

function RoleCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-neutral-800/60 hover:bg-neutral-800 border border-white/5 hover:border-brand-500/40 transition-all duration-300 rounded-2xl p-6 flex flex-col items-center gap-3 text-white hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/40"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <span className="font-semibold">{title}</span>
      <span className="text-xs text-neutral-400">{subtitle}</span>
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { status, admin, cashier, setAdminSession, setCashierSession } = useAuthSession();
  const [mode, setMode] = useState<Mode>("CHOOSE");

  // Si el chequeo de fondo (`<AuthProvider>`, ver punto 42 de
  // admin-frontend/CLAUDE.md) resuelve que YA hay una sesión activa —
  // sea porque el navegador todavía tenía una cookie válida al entrar a
  // /login, o porque el login que se acaba de hacer más abajo actualizó
  // el estado compartido — manda para la zona que corresponda. A
  // propósito NO bloquea el render de este componente mientras
  // `status === "checking"`: el formulario de login ya se pintó antes de
  // que este efecto tenga algo que hacer.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (admin) {
      navigate("/dashboard", { replace: true });
    } else if (cashier) {
      navigate("/cajero/caja", { replace: true });
    }
  }, [status, admin, cashier, navigate]);

  // --- Admin ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  // --- Olvidé mi contraseña ---
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // --- Cajero ---
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [pin, setPin] = useState("");
  const [cashierError, setCashierError] = useState("");
  const [cashierLoading, setCashierLoading] = useState(false);

  useEffect(() => {
    if (mode === "CASHIER_BRANCH") {
      posApi.getBranches().then(setBranches).catch(() => setCashierError("No se pudo cargar sedes"));
    }
  }, [mode]);

  const submitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError("");
    try {
      const { user } = await adminApi.login(email, password);
      // Actualiza el estado compartido con el perfil que ya trajo el login
      // (id/name/role/branchId) — evita otro viaje a /me solo para
      // confirmar algo que la respuesta del login ya dice. El efecto de
      // arriba se encarga de navegar en cuanto ve `status: "authenticated"`.
      setAdminSession(user);
    } catch (err: any) {
      setAdminError(err.message || "Credenciales inválidas");
    } finally {
      setAdminLoading(false);
    }
  };

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    try {
      await adminApi.forgotPassword(forgotEmail);
      // Mensaje siempre genérico (exista o no la cuenta) — el backend ya
      // responde igual en ambos casos, ver punto 40 de backend/CLAUDE.md.
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err.message || "No se pudo enviar el correo");
    } finally {
      setForgotLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) submitCashier(next);
  };

  const submitCashier = async (fullPin: string) => {
    if (!selectedBranch) return;
    setCashierLoading(true);
    setCashierError("");
    try {
      const { cashier } = await posApi.login(selectedBranch._id, fullPin);
      // La cookie httpOnly ya quedó puesta por el backend (Set-Cookie).
      // CashierLayout hidrata el store llamando a /auth/me al montar —
      // esto solo actualiza el estado compartido de auth (gating), no el
      // store de Zustand. El efecto de arriba navega en cuanto ve
      // `status: "authenticated"`.
      setCashierSession(cashier);
    } catch (err: any) {
      setCashierError(err.message || "PIN inválido");
      setPin("");
    } finally {
      setCashierLoading(false);
    }
  };

  // --- Pantalla de elección de rol ---
  if (mode === "CHOOSE") {
    return (
      <AuthShell>
        <GlassCard>
          <p className="text-center text-neutral-300 text-sm mb-6">¿Cómo vas a ingresar hoy?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RoleCard
              icon={<Receipt size={24} className="text-white" />}
              title="Soy Cajero"
              subtitle="Acceso con PIN"
              onClick={() => setMode("CASHIER_BRANCH")}
            />
            <RoleCard
              icon={<ShieldCheck size={24} className="text-white" />}
              title="Soy Administrador"
              subtitle="Acceso con correo"
              onClick={() => setMode("ADMIN")}
            />
          </div>
        </GlassCard>
      </AuthShell>
    );
  }

  // --- Login de administrador ---
  if (mode === "ADMIN") {
    return (
      <AuthShell>
        <GlassCard>
          <BackButton onClick={() => setMode("CHOOSE")}>Volver</BackButton>

          <h1 className="text-lg font-bold text-white">Panel Administrativo</h1>
          <p className="text-sm text-neutral-400 mb-6">Ingresa con tu correo y contraseña</p>

          <form onSubmit={submitAdmin} className="flex flex-col gap-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo"
                className="w-full bg-neutral-800/60 border border-white/10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 transition-colors"
                required
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full bg-neutral-800/60 border border-white/10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none rounded-xl py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-neutral-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {adminError && <p className="text-red-400 text-xs">{adminError}</p>}

            <button
              type="submit"
              disabled={adminLoading}
              className="mt-2 bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl py-2.5 font-medium shadow-lg shadow-brand-900/40 disabled:opacity-50 transition-all"
            >
              {adminLoading ? "Ingresando..." : "Ingresar"}
            </button>

            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setForgotError("");
                setForgotSent(false);
                setMode("FORGOT_PASSWORD");
              }}
              className="text-xs text-neutral-400 hover:text-white transition-colors text-center"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </GlassCard>
      </AuthShell>
    );
  }

  // --- Olvidé mi contraseña (solo ADMIN/MANAGER, tienen correo) ---
  if (mode === "FORGOT_PASSWORD") {
    return (
      <AuthShell>
        <GlassCard>
          <BackButton onClick={() => setMode("ADMIN")}>Volver</BackButton>

          <h1 className="text-lg font-bold text-white">Recuperar contraseña</h1>
          <p className="text-sm text-neutral-400 mb-6">
            Ingresa tu correo y te enviaremos un enlace para restablecerla
          </p>

          {forgotSent ? (
            <p className="text-sm text-green-400">
              Si el correo existe, se envió un enlace de recuperación. Revisa tu bandeja de
              entrada (y la carpeta de spam).
            </p>
          ) : (
            <form onSubmit={submitForgotPassword} className="flex flex-col gap-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Correo"
                  className="w-full bg-neutral-800/60 border border-white/10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 transition-colors"
                  required
                />
              </div>

              {forgotError && <p className="text-red-400 text-xs">{forgotError}</p>}

              <button
                type="submit"
                disabled={forgotLoading}
                className="mt-2 bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl py-2.5 font-medium shadow-lg shadow-brand-900/40 disabled:opacity-50 transition-all"
              >
                {forgotLoading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>
          )}
        </GlassCard>
      </AuthShell>
    );
  }

  // --- Selección de sede del cajero ---
  if (mode === "CASHIER_BRANCH") {
    return (
      <AuthShell>
        <GlassCard>
          <BackButton onClick={() => setMode("CHOOSE")}>Volver</BackButton>

          <h1 className="text-lg font-bold text-white">Selecciona tu sede</h1>
          <p className="text-sm text-neutral-400 mb-6">Elige dónde vas a abrir caja</p>

          {cashierError && <p className="text-red-400 text-sm mb-3">{cashierError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {branches.map((b) => (
              <button
                key={b._id}
                onClick={() => {
                  setSelectedBranch(b);
                  setMode("CASHIER_PIN");
                }}
                className="group bg-neutral-800/60 hover:bg-neutral-800 border border-white/5 hover:border-brand-500/40 transition-all duration-300 rounded-2xl p-4 flex items-start gap-3 text-left hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-900/30"
              >
                <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow shadow-brand-900/40 group-hover:scale-110 transition-transform duration-300">
                  <MapPinHouse size={16} className="text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{b.name}</div>
                  <div className="text-neutral-400 text-xs mt-0.5">{b.address}</div>
                </div>
              </button>
            ))}
            {branches.length === 0 && !cashierError && (
              <p className="text-neutral-500 text-sm col-span-2 text-center py-4">Cargando sedes...</p>
            )}
          </div>
        </GlassCard>
      </AuthShell>
    );
  }

  // --- Teclado PIN del cajero ---
  return (
    <AuthShell>
      <GlassCard>
        <BackButton
          onClick={() => {
            setMode("CASHIER_BRANCH");
            setPin("");
            setCashierError("");
          }}
        >
          Cambiar de sede
        </BackButton>

        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold text-white text-center">{selectedBranch?.name}</h1>
          <p className="text-sm text-neutral-400 mb-6">Ingresa tu PIN de 4 dígitos</p>

          <div className="flex gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                  pin.length > i ? "bg-brand-500 border-brand-500" : "border-neutral-600"
                }`}
              />
            ))}
          </div>

          {cashierError && <p className="text-red-400 text-sm mb-3">{cashierError}</p>}
          {cashierLoading && <p className="text-neutral-400 text-sm mb-3">Verificando...</p>}

          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => handlePinDigit(d)}
                className="w-16 h-16 rounded-full bg-neutral-800/70 hover:bg-neutral-700 active:scale-90 transition-all text-xl font-semibold text-white"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setPin("")}
              className="w-16 h-16 rounded-full bg-neutral-800/70 hover:bg-neutral-700 active:scale-90 transition-all flex items-center justify-center text-neutral-300"
              aria-label="Borrar"
            >
              <Delete size={20} />
            </button>
            <button
              onClick={() => handlePinDigit("0")}
              className="w-16 h-16 rounded-full bg-neutral-800/70 hover:bg-neutral-700 active:scale-90 transition-all text-xl font-semibold text-white"
            >
              0
            </button>
          </div>
        </div>
      </GlassCard>
    </AuthShell>
  );
}
