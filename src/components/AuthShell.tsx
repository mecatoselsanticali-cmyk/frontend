import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Chrome compartido de las pantallas de autenticación (Login.tsx y
 * ResetPassword.tsx) — extraído de Login.tsx para que ambas páginas usen
 * exactamente el mismo fondo/logo/card en vez de duplicar el JSX. Solo
 * modo oscuro (ver punto 27 de admin-frontend/CLAUDE.md — el toggle
 * claro/oscuro que existía se quitó a pedido explícito).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-hidden px-4 py-10 bg-neutral-950">
      <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full blur-3xl bg-brand-600/30" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl bg-red-600/20" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full blur-3xl bg-brand-500/10" />

      <div className="relative w-full max-w-md flex flex-col items-center">
        <img
          src="/img/logo-santi-trimmed.png"
          alt="Mecatos el Santi"
          draggable={false}
          className="w-44 sm:w-52 select-none drop-shadow-[0_0_40px_rgba(234,88,12,0.35)]"
        />
        <p className="mt-1 text-sm text-neutral-400">Comidas · Punto de venta</p>

        {children}
      </div>

      <p className="relative mt-10 text-xs text-neutral-600 text-center">
        © {new Date().getFullYear()} Mecatos el Santi. Todos los derechos reservados.
      </p>
    </div>
  );
}

export function GlassCard({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`mt-8 w-full bg-neutral-900/70 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 transition-all duration-500 ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      {children}
    </div>
  );
}

export function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors mb-4"
    >
      <ChevronLeft size={16} />
      {children}
    </button>
  );
}
