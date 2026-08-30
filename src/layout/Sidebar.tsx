import { NavLink } from "react-router-dom";
import { adminApi } from "../services/api";
import { BadgeDollarSign, BanknoteArrowDown, BanknoteArrowUp, Calculator, Layers, LayoutDashboard, LogOut, MapPinHouse, Settings, ShoppingCart, User, Wallet, X } from "lucide-react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente de sede",
  CASHIER: "Cajero",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

// `roles` ausente = visible para cualquier rol autenticado. Sedes y
// Personal son solo de ADMIN — un gerente ya está fijado a su propia sede
// (ver Layout.tsx) y no gestiona personal de otras sedes (ver punto 18 de
// CLAUDE.md); el backend refuerza esto mismo en GET /users y en las rutas
// de escritura de /branches y /users, así que ocultar el link acá es solo
// UX, no la única barrera.
const links = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { to: "/sedes", label: "Sedes", icon: <MapPinHouse size={20} />, roles: ["ADMIN"] },
  { to: "/inventario", label: "Inventario", icon: <Layers size={20} /> },
  { to: "/compras", label: "Compras", icon: <ShoppingCart size={20} /> },
  { to: "/ventas", label: "Ventas", icon: <BadgeDollarSign size={20} /> },
  { to: "/gastos", label: "Gastos", icon: <Calculator size={20} /> },
  { to: "/personal", label: "Personal", icon: <User size={20} />, roles: ["ADMIN"] },
  { to: "/finanzas", label: "Finanzas", icon: <Wallet size={20} /> },
];

/**
 * { to: "/cuentas-por-pagar", label: "Cuentas por Pagar", icon: <BanknoteArrowDown size={20} /> },
  { to: "/cuentas-por-cobrar", label: "Cuentas por Cobrar", icon: <BanknoteArrowUp size={20} /> },
  { to: "/dian-config", label: "Config. DIAN", icon: <Settings size={20} /> },
 *
 */

interface SidebarProps {
  name?: string;
  role?: string;
  /** Controla la visibilidad del drawer en pantallas móviles (`< md`) — en
   * `md:` para arriba el sidebar siempre está visible y estas props no
   * afectan nada (ver clases `md:static md:translate-x-0` más abajo). */
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ name, role, isOpen = false, onClose }: SidebarProps) {
  const visibleLinks = links.filter((link) => !link.roles || link.roles.includes(role || ""));

  return (
    <>
      {/* Fondo oscuro detrás del drawer — solo en móvil, y solo mientras
          está abierto. Tocarlo cierra el menú, igual que el botón ✕. */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 h-screen bg-neutral-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:translate-x-0 md:z-auto`}
      >
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">Mecatos el Santi</h1>
            <p className="text-xs text-neutral-400">Panel Administrativo</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="md:hidden text-neutral-400 hover:text-white p-1 -mr-1"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-neutral-300 hover:bg-neutral-800"
                }`
              }
            >
              <span>{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-neutral-800 space-y-3">
          {name && (
            <div className="flex items-center gap-3 px-1">
              <div className="w-9 h-9 shrink-0 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center justify-center">
                {initials(name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{name}</p>
                <p className="text-xs text-neutral-400 truncate">{roleLabels[role || ""] || role}</p>
              </div>
            </div>
          )}
          <button
            onClick={async () => {
              try {
                await adminApi.logout(); // limpia la cookie httpOnly en el backend
              } catch {
                // si falla la llamada, igual mandamos al login
              }
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
