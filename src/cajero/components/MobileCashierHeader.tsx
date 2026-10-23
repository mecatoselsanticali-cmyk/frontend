import { LogOut } from "lucide-react";

interface MobileCashierHeaderProps {
  shiftActive: boolean;
  onCloseShift: () => void;
  onLogout: () => void;
}

export default function MobileCashierHeader({ shiftActive, onCloseShift, onLogout }: MobileCashierHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-2 bg-zinc-900 px-3 py-3 text-white md:hidden">
      <img src="/img/logo-santi-trimmed.webp" alt="Mecatos el Santi" className="h-10 w-10 shrink-0 object-contain" />
      {shiftActive ? (
        <button type="button" onClick={onCloseShift} className="shrink-0 rounded-xl border border-orange-500/30 bg-orange-600/20 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
          Finalizar turno
        </button>
      ) : <span className="text-xs font-medium text-zinc-400">Inicio de turno</span>}
      <button type="button" onClick={onLogout} className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700/60 px-2 py-1.5 text-xs text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
        <LogOut size={13} aria-hidden="true" />
      </button>
    </header>
  );
}
