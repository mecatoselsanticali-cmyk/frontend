import { useEffect, useId, useRef, useState } from "react";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import InstallAppButton from "../components/InstallAppButton";
import type { AdminMenuProfile } from "./Layout";

// Mismo breakpoint que el `md:hidden` del botón de hamburguesa de abajo
// (768px) — hook local, mismo criterio de "cada archivo mantiene su
// propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// CashierLayout.tsx, no hay un hook compartido para esto en el proyecto.
// Nombres reales de sede son largos ("Mecatos el Santi — Sede Centro") y,
// igual que "Todas las sedes" (ver comentario más abajo), el texto de un
// <option> no se puede acortar con CSS — en celular se muestra solo la
// última palabra ("Centro"), suficiente para distinguir sedes entre sí
// sin repetir el nombre completo del negocio en cada opción.
function lastWord(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("not all and (min-width: 768px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("not all and (min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function MobileProfile({ userName, userInitials, userRole, handleLogout }: AdminMenuProfile) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsProfileMenuOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [isProfileMenuOpen]);

  return (
    <div ref={profileMenuRef} className="relative shrink-0 md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsProfileMenuOpen((open) => !open)}
        aria-label="Opciones de perfil"
        aria-expanded={isProfileMenuOpen}
        aria-controls={isProfileMenuOpen ? panelId : undefined}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-500/40 bg-[#4A2511] text-xs font-extrabold text-orange-400 shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        {userInitials}
      </button>

      {isProfileMenuOpen && (
        <div id={panelId} className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-[#1F1F1F] p-1.5 text-white shadow-2xl">
          <div className="mb-1 border-b border-white/10 px-3 py-2">
            <p className="truncate text-xs font-bold text-white" title={userName}>{userName}</p>
            <p className="truncate text-[11px] text-neutral-400">{userRole}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsProfileMenuOpen(false);
              void handleLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 active:bg-rose-500/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <LogOut size={16} className="shrink-0" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

interface TopbarProps {
  dark: boolean;
  onToggleTheme: () => void;
  hideBranchSelector?: boolean;
  profile: AdminMenuProfile;
  title: string;
  branches: { _id: string; name: string }[];
  selectedBranch: string;
  onBranchChange: (branchId: string) => void;
  /** Si viene definido (gerente de sede), reemplaza el selector por texto fijo. */
  lockedBranchName?: string;
  /** Abre el drawer del Sidebar en móvil — el botón solo se muestra `< md`. */
  onMenuClick: () => void;
}

export default function Topbar({
  dark,
  onToggleTheme,
  title,
  hideBranchSelector,
  profile,
  branches,
  selectedBranch,
  onBranchChange,
  lockedBranchName,
  onMenuClick,
}: TopbarProps) {
  const isMobile = useIsMobile();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 max-md:sticky max-md:top-0 max-md:z-30 max-md:border-white/10 max-md:!bg-neutral-900 max-md:text-white md:h-16 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          data-tour="menu-button"
          className="-ml-1.5 shrink-0 rounded-lg p-1.5 text-neutral-200 transition-colors hover:text-white active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:hidden"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <h2 className="truncate text-base font-bold tracking-tight text-neutral-800 max-md:!text-white md:text-xl md:tracking-normal">{title}</h2>
      </div>
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        {!hideBranchSelector && (lockedBranchName ? (
          <span
            data-tour="branch-selector"
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-600 bg-neutral-50 max-md:truncate max-md:border-white/10 max-md:!bg-white/5 max-md:!text-neutral-200"
          >
            {lockedBranchName}
          </span>
        ) : (
          <select
            data-tour="branch-selector"
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="max-w-auto border border-neutral-200 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-brand-500 max-md:min-w-0 max-md:truncate max-md:border-white/10 max-md:!bg-neutral-900 max-md:!text-neutral-200 max-md:text-xs"
          >
            {/* "Todas las sedes" (el texto real de un <option> no se puede
                acortar solo con CSS/clases responsive — un select nativo
                siempre pinta el texto tal cual) empujaba el título de la
                página fuera de la vista en celular, donde el header ya
                comparte espacio con el botón de hamburguesa. Se acorta a
                "Todas" por debajo de 768px. */}
            <option value="">{isMobile ? "Todas" : "Todas las sedes"}</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {isMobile ? lastWord(b.name) : b.name}
              </option>
            ))}
          </select>
        ))}
        <InstallAppButton />
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          aria-pressed={dark}
          title={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="erp-theme-toggle inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 max-md:h-9 max-md:w-9 max-md:!border-white/10 max-md:!bg-white/5 max-md:!text-white max-md:hover:!bg-white/10 md:px-3 md:py-2"
        >
          {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span className="hidden md:inline">{dark ? "Modo claro" : "Modo oscuro"}</span>
        </button>
        {isMobile && <MobileProfile {...profile} />}
      </div>
    </header>
  );
}
