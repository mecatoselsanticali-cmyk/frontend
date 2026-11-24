import { Download } from "lucide-react";
import Swal from "sweetalert2";
import { usePwaInstall } from "../hooks/usePwaInstall";

/** Botón "Instalar app" — solo aparece si el navegador permite instalar la PWA (o en iOS, con instrucciones). */
export default function InstallAppButton() {
  const { canInstall, showIosHint, install } = usePwaInstall();
  if (!canInstall && !showIosHint) return null;

  const onClick = () => {
    if (canInstall) return void install();
    Swal.fire({
      title: "Instalar en tu iPhone/iPad",
      html: "En Safari toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>.",
      icon: "info",
      confirmButtonText: "Entendido",
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Instalar app"
      title="Instalar app"
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 max-md:h-9 max-md:w-9 max-md:!border-white/10 max-md:!bg-white/5 max-md:!text-white max-md:hover:!bg-white/10 md:px-3 md:py-2"
    >
      <Download size={18} aria-hidden="true" />
      <span className="hidden md:inline">Instalar app</span>
    </button>
  );
}
