import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

// Mismo breakpoint que el `md:hidden` del botón de hamburguesa de abajo
// (768px) — hook local, mismo criterio de "cada archivo mantiene su
// propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// CashierLayout.tsx, no hay un hook compartido para esto en el proyecto.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

interface TopbarProps {
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
  title,
  branches,
  selectedBranch,
  onBranchChange,
  lockedBranchName,
  onMenuClick,
}: TopbarProps) {
  const isMobile = useIsMobile();

  return (
    <header className="h-16 border-b border-neutral-200 bg-white flex items-center justify-between px-4 md:px-6 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="md:hidden text-neutral-500 hover:text-neutral-800 p-1 -ml-1 shrink-0"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-xl font-bold text-neutral-800 truncate">{title}</h2>
      </div>
      {lockedBranchName ? (
        <span
          data-tour="branch-selector"
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-600 bg-neutral-50"
        >
          {lockedBranchName}
        </span>
      ) : (
        <select
          data-tour="branch-selector"
          value={selectedBranch}
          onChange={(e) => onBranchChange(e.target.value)}
          className={`${isMobile ? "w-24" : "w-48"
          } border border-neutral-200 rounded-lg px-3 py-2 text-sm`}
        >
          {/* "Todas las sedes" (el texto real de un <option> no se puede
              acortar solo con CSS/clases responsive — un select nativo
              siempre pinta el texto tal cual) empujaba el título de la
              página fuera de la vista en celular, donde el header ya
              comparte espacio con el botón de hamburguesa. Se acorta a
              "Sedes" por debajo de 768px. */}
          <option value="">{isMobile ? "Sedes" : "Todas las sedes"}</option>
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
    </header>
  );
}
