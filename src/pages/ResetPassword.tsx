import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { adminApi } from "../services/api";
import { AuthShell, GlassCard } from "../components/AuthShell";

/**
 * Pantalla que abre el link del correo de "Olvidé mi contraseña"
 * (`/reset-password?token=...`, ver `forgotPassword` en
 * `backend/CLAUDE.md`). El token nunca se valida acá en el cliente — solo
 * se manda tal cual al backend, que es quien decide si es válido/no
 * expiró (ver `resetPassword` en authController.ts).
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await adminApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "El enlace es inválido o ya expiró");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <GlassCard>
          <h1 className="text-lg font-bold text-white">Enlace inválido</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Este enlace de recuperación no es válido. Solicita uno nuevo desde la pantalla de
            inicio de sesión.
          </p>
          <Link
            to="/login"
            className="mt-6 block text-center bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl py-2.5 font-medium shadow-lg shadow-brand-900/40 transition-all"
          >
            Volver al inicio de sesión
          </Link>
        </GlassCard>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <GlassCard>
          <h1 className="text-lg font-bold text-white">Contraseña actualizada</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Ya puedes ingresar al panel administrativo con tu nueva contraseña.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="mt-6 w-full bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl py-2.5 font-medium shadow-lg shadow-brand-900/40 transition-all"
          >
            Ir a iniciar sesión
          </button>
        </GlassCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <GlassCard>
        <h1 className="text-lg font-bold text-white">Nueva contraseña</h1>
        <p className="text-sm text-neutral-400 mb-6">Elige una contraseña nueva para tu cuenta</p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
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

          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar contraseña"
              className="w-full bg-neutral-800/60 border border-white/10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 outline-none rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-500 transition-colors"
              required
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl py-2.5 font-medium shadow-lg shadow-brand-900/40 disabled:opacity-50 transition-all"
          >
            {loading ? "Guardando..." : "Guardar contraseña"}
          </button>
        </form>
      </GlassCard>
    </AuthShell>
  );
}
