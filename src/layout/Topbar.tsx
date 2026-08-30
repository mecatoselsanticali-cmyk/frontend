import { Menu } from "lucide-react";

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
        <span className="border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-600 bg-neutral-50">
          {lockedBranchName}
        </span>
      ) : (
        <select
          value={selectedBranch}
          onChange={(e) => onBranchChange(e.target.value)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Todas las sedes</option>
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
