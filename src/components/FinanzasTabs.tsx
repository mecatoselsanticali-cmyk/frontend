import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/finanzas/caja", label: "Caja" },
  { to: "/finanzas/reportes", label: "Reportes" },
];

/** Barra de pestañas compartida entre FinanzasCaja.tsx y FinanzasReportes.tsx. */
export default function FinanzasTabs() {
  return (
    <div className="inline-flex bg-zinc-100 rounded-xl p-1 gap-1 text-sm font-medium">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
