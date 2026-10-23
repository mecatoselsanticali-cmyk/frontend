import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BadgeDollarSign, Calculator, Layers, LayoutDashboard, LogOut,
  PanelLeftClose, PanelLeftOpen, MapPinHouse, ShoppingCart, User, Wallet, X, type LucideIcon,
} from "lucide-react";
import { adminApi } from "../services/api";

interface SidebarProps {
  name?: string;
  role?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  tour?: string;
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente de sede",
  CASHIER: "Cajero",
};

// Los permisos visuales complementan las restricciones del backend.
// Las anclas del tour se conservan en los enlaces correspondientes.
const sections: NavigationSection[] = [
  {
    title: "Operaciones",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/sedes", label: "Sedes", icon: MapPinHouse, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Gestión",
    items: [
      { to: "/inventario", label: "Inventario", icon: Layers, tour: "inventory-link" },
      { to: "/compras", label: "Compras", icon: ShoppingCart },
      { to: "/ventas", label: "Ventas", icon: BadgeDollarSign, tour: "logs-link" },
      { to: "/gastos", label: "Gastos", icon: Calculator },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/personal", label: "Personal", icon: User, roles: ["ADMIN"] },
      { to: "/finanzas", label: "Finanzas", icon: Wallet, tour: "closures-link" },
    ],
  },
];

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0)).join("").toUpperCase();
}

function SidebarLink({ item, onNavigate, collapsed }: {
  collapsed: boolean;
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      data-tour={item.tour}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => [
        "mx-3 flex items-center gap-3 rounded-xl px-3 py-2.5",
        "text-sm font-medium transition-colors",
        collapsed ? "md:justify-center md:px-0" : "",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900",
        isActive ? "bg-orange-600 text-white" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white",
      ].join(" ")}
    >
      <Icon size={19} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
      <span className={collapsed ? "md:sr-only" : ""}>{item.label}</span>
    </NavLink>
  );
}

function UserProfile({ name, role, collapsed }: Pick<SidebarProps, "name" | "role"> & { collapsed: boolean }) {
  const displayName = name?.trim() || "Usuario";

  const handleLogout = async () => {
    try {
      await adminApi.logout();
    } catch {
      // Permite volver al login aunque la solicitud falle.
    }
    window.location.href = "/login";
  };

  return (
    <footer className="shrink-0 border-t border-zinc-800 py-4">
      <div className={`mx-3 flex items-center justify-between gap-2 rounded-xl bg-zinc-900/50 p-3 ${collapsed ? "md:flex-col md:px-0" : ""}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div title={displayName}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-600/15 text-xs font-semibold text-orange-400">
            {getInitials(displayName)}
          </div>
          <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
            <p className="truncate text-sm font-medium text-zinc-100" title={displayName}>{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{roleLabels[role || ""] || role || "Sesión activa"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}

export default function Sidebar({ name, role, isOpen = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />}
      {/* h-dvh mantiene el perfil visible cuando cambia la barra de Safari móvil. */}
      <aside className={[
        "fixed inset-y-0 left-0 z-50 flex h-dvh w-60 shrink-0 flex-col",
        "bg-neutral-900 text-white transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none",
        collapsed ? "md:w-20" : "md:w-60",
        "md:static md:z-auto md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}>
        <div className={`shrink-0 px-5 pb-3 pt-6 ${collapsed ? "md:px-3" : ""}`}>
          <div className="flex items-start justify-between gap-2">
            <div className={`flex min-w-0 flex-1 flex-col items-center gap-3 text-center ${collapsed ? "md:gap-0" : ""}`}>
              <img src="/img/logo-santi-trimmed.webp" alt="Mecatos el Santi" className={`h-20 w-full object-contain ${collapsed ? "md:h-12" : ""}`} />
              <div className={collapsed ? "md:hidden" : ""}>
                <h1 className="text-base font-bold tracking-tight text-white">Mecatos el Santi</h1>
                <p className="mt-1 text-xs text-zinc-500">Panel Administrativo</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar menú" className="-mr-2 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:hidden">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir menú" : "Colapsar menú"} title={collapsed ? "Expandir menú" : "Colapsar menú"} aria-expanded={!collapsed} aria-controls="sidebar-navigation" className={`mt-4 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:flex ${collapsed ? "justify-center px-0" : ""}`}>
            {collapsed ? <PanelLeftOpen size={18} className="shrink-0" aria-hidden="true" /> : <PanelLeftClose size={18} className="shrink-0" aria-hidden="true" />}
            {!collapsed && <span>Colapsar menú</span>}
          </button>
        </div>
        <nav id="sidebar-navigation" aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto pb-6">
          {sections.map((section) => {
            const visibleItems = section.items.filter((item) => !item.roles || item.roles.includes(role || ""));
            if (!visibleItems.length) return null;
            return (
              <section key={section.title} aria-label={section.title} className={collapsed ? "md:mb-3 md:border-b md:border-zinc-800 md:pb-3 md:last:mb-0 md:last:border-0" : ""}>
                <h2 className={`mb-2 mt-6 px-4 text-[10px] font-medium uppercase tracking-wider text-zinc-500 ${collapsed ? "md:sr-only" : ""}`}>{section.title}</h2>
                <div className="space-y-1">
                  {visibleItems.map((item) => <SidebarLink key={item.to} item={item} onNavigate={onClose} collapsed={collapsed} />)}
                </div>
              </section>
            );
          })}
        </nav>
        <UserProfile name={name} role={role} collapsed={collapsed} />
      </aside>
    </>
  );
}
