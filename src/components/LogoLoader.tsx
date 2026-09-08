type LogoLoaderSize = "sm" | "md" | "lg";

interface LogoLoaderProps {
  /** @default "md" */
  size?: LogoLoaderSize;
  /** Cubre toda la pantalla (`fixed inset-0`) con un overlay difuminado, en vez de renderizarse inline. @default false */
  fullScreen?: boolean;
  /** Mensaje opcional debajo del logo, ej. "Cargando..." / "Verificando sesión...". */
  text?: string;
  className?: string;
}

const SIZES: Record<LogoLoaderSize, { logo: string; ring: string; border: string; text: string }> = {
  sm: { logo: "w-10 h-10", ring: "w-16 h-16", border: "border-2", text: "text-xs" },
  md: { logo: "w-16 h-16", ring: "w-24 h-24", border: "border-[3px]", text: "text-sm" },
  lg: { logo: "w-24 h-24", ring: "w-36 h-36", border: "border-4", text: "text-base" },
};

/**
 * Loader de marca — reemplazo de spinners genéricos ("Cargando...",
 * "Verificando sesión...") en cualquier punto de la app que necesite un
 * estado de carga (rutas, modales, pantallas completas). Combina el logo
 * con una animación de escala/opacidad (`animate-logo-pulse`, keyframe
 * propio en `tailwind.config.js` — el `animate-pulse` de Tailwind por sí
 * solo solo anima opacidad, acá también hace falta un scale sutil), un
 * anillo girando (`animate-spin`, nativo de Tailwind) y un resplandor
 * difuminado detrás (`animate-pulse` + `blur-xl`) — todo con utilidades
 * de Tailwind, sin CSS-in-JS ni librería de animación nueva.
 */
export default function LogoLoader({ size = "md", fullScreen = false, text, className = "" }: LogoLoaderProps) {
  const s = SIZES[size];

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Resplandor difuminado detrás del anillo/logo */}
        <div className={`absolute ${s.ring} rounded-full bg-brand-500/20 blur-xl animate-pulse`} />
        {/* Anillo girando */}
        <div
          className={`absolute ${s.ring} ${s.border} rounded-full border-neutral-200 border-t-brand-600 animate-spin`}
        />
        {/* Logo con pulso de escala */}
        <img
          src="/img/logo-santi-trimmed.webp"
          alt="Mecatos el Santi"
          draggable={false}
          className={`relative z-10 ${s.logo} object-contain select-none animate-logo-pulse`}
        />
      </div>
      {text && <p className={`${s.text} text-neutral-500 font-medium mt-2`}>{text}</p>}
    </div>
  );

  if (!fullScreen) return content;

  // `!m-0` obligatorio en cualquier `fixed inset-0` (ver punto 28 de
  // admin-frontend/CLAUDE.md) — sin esto, un `<div className="space-y-4">`
  // contenedor le mete un margen que lo desplaza hacia abajo, dejando un
  // borde de la pantalla sin cubrir.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm !m-0">
      {content}
    </div>
  );
}
