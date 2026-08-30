import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface ActionsMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionsMenuProps {
  items: ActionsMenuItem[];
}

/**
 * Botón de tres puntos con un menú flotante debajo, para usar en la columna
 * "Acciones" de una tabla. Se renderiza vía `createPortal` en
 * `document.body` y se posiciona con `position: fixed` a partir del
 * `getBoundingClientRect()` del botón — así el menú no lo recorta ningún
 * contenedor ancestro con `overflow-hidden` (ej. el wrapper redondeado de
 * las tablas de este panel).
 */
export default function ActionsMenu({ items }: ActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // El setTimeout evita que el mismo click que abre el menú (que también
    // burbujea hasta `window`) lo vuelva a cerrar en el mismo tick.
    const id = window.setTimeout(() => window.addEventListener("click", close), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("click", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className="text-neutral-400 hover:text-neutral-600 p-1 rounded"
        aria-label="Más acciones"
      >
        <MoreVertical size={18} />
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: coords.top, right: coords.right }}
            className="z-50 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-40"
          >
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 ${
                  item.danger ? "text-red-500" : "text-neutral-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
