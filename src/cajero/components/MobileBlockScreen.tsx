import { Monitor } from "lucide-react";

// Copia intencional del fondo/logo de `AuthShell` en `pages/Login.tsx`
// (gradiente + resplandores + logo) — no se importa desde ahí porque
// `src/cajero/` nunca importa de fuera de `src/cajero/` salvo el propio
// Login.tsx (ver punto 12 de admin-frontend/src/cajero/CLAUDE.md). Se
// omite el toggle claro/oscuro de Login.tsx a propósito: acá no hay nada
// que persistir en localStorage, es una pantalla de un solo mensaje.
export default function MobileBlockScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden px-4 py-10 bg-gradient-to-br from-orange-50 via-amber-50 to-neutral-100">
      <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full blur-3xl bg-brand-300/40" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl bg-red-300/30" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full blur-3xl bg-brand-200/30" />

      <div className="relative w-full max-w-md flex flex-col items-center">
        <img
          src="/img/logo-santi-trimmed.png"
          alt="Mecatos el Santi"
          draggable={false}
          className="w-44 sm:w-52 select-none drop-shadow-[0_0_30px_rgba(234,88,12,0.25)]"
        />
        <p className="mt-1 text-sm text-neutral-500">Comidas · Punto de venta</p>

        <div className="mt-8 w-full bg-neutral-900/70 backdrop-blur-xl border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40">
            <Monitor size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Usa un computador</h1>
            <p className="text-sm text-neutral-400 mt-1">
              La caja de Mecatos el Santi no está disponible desde el celular — inicia sesión
              desde el computador de la sede para registrar ventas.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="w-full bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-500 hover:to-brand-600 text-white rounded-xl py-2.5 font-medium shadow-lg shadow-brand-900/40 transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
