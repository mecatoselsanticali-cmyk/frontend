import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

interface ComboProduct {
  _id: string;
  name: string;
  sku?: string;
}

interface ProductComboboxProps {
  products: ComboProduct[];
  value: string;
  onChange: (productId: string) => void;
  /** Si viene, se muestra "+ Crear nuevo producto" como primera fila de la lista (siempre visible, sin importar lo que se escriba). */
  onCreateNew?: () => void;
  placeholder?: string;
  /** Tamaño de texto del input — `text-base` (16px) por default para no disparar el zoom de iOS Safari (ver punto 57 de CLAUDE.md). */
  textSizeClass?: string;
}

// Sin tildes y en minúsculas — buscar "cafe" tiene que encontrar "Café".
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Selector de producto con búsqueda por nombre o SKU — reemplaza al
 * `<select>` nativo en los modales de compra, donde una lista larga de
 * productos era difícil de recorrer. Al enfocar/clickear se despliega la
 * lista COMPLETA (como un select); al escribir se filtra.
 *
 * La lista se renderiza en un portal con `position: fixed` (mismo enfoque
 * que `ActionsMenu.tsx`, ver punto 22 de CLAUDE.md) porque el modal que la
 * contiene tiene `overflow-y-auto` y un dropdown absoluto quedaría recortado
 * o estiraría el scroll del modal. Como es fija, se cierra al hacer scroll
 * o redimensionar en vez de quedar desalineada del input.
 *
 * Copia intencional de `src/components/ProductCombobox.tsx` (esta zona no
 * importa nada de fuera de sí misma, ver punto 12 de CLAUDE.md) — si
 * cambias uno, cambia el otro. El cajero no pasa `onCreateNew`: no tiene
 * permiso para crear productos, solo elige del catálogo existente.
 */
export default function ProductCombobox({
  products,
  value,
  onChange,
  onCreateNew,
  placeholder = "Buscar por nombre o SKU",
  textSizeClass = "text-base",
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = products.find((p) => p._id === value);
  const selectedLabel = selected ? `${selected.name}${selected.sku ? ` (${selected.sku})` : ""}` : "";

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return products;
    return products.filter((p) => normalize(p.name).includes(q) || normalize(p.sku || "").includes(q));
  }, [products, query]);

  // Índice 0 es la fila "+ Crear nuevo producto" si existe; el resto son productos.
  const offset = onCreateNew ? 1 : 0;
  const rowCount = filtered.length + offset;

  const openList = () => {
    const el = wrapperRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  };

  const closeAndBlur = () => {
    setOpen(false);
    // Al cerrar se vuelve a mostrar la etiqueta del producto elegido en el
    // input — sacar el foco evita que escribir después se "pegue" a esa
    // etiqueta en vez de arrancar una búsqueda nueva.
    inputRef.current?.blur();
  };

  const choose = (index: number) => {
    if (index < 0 || index >= rowCount) return;
    if (onCreateNew && index === 0) {
      closeAndBlur();
      onCreateNew();
      return;
    }
    onChange(filtered[index - offset]._id);
    closeAndBlur();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      // Scrollear la propia lista no debe cerrarla.
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(rowCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // preventDefault: el input vive dentro de un formulario/modal, Enter no debe enviarlo.
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAndBlur();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          onFocus={() => {
            if (!open) openList();
          }}
          onClick={() => {
            if (!open) openList();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            // Al filtrar, resalta el primer PRODUCTO (no la fila de "crear").
            setActiveIndex(offset);
          }}
          onKeyDown={onKeyDown}
          className={`w-full border border-neutral-200 rounded-lg p-2 pr-8 ${textSizeClass} focus:outline-none focus:ring-1 focus:ring-brand-500`}
        />
        <ChevronDown
          size={16}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
        />
      </div>

      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-[70] max-h-60 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-sm"
          >
            {onCreateNew && (
              <li
                role="option"
                aria-selected={false}
                data-active={activeIndex === 0}
                // mousedown (no click) + preventDefault: el input no debe perder el foco antes de elegir.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(0);
                }}
                onMouseEnter={() => setActiveIndex(0)}
                className={`px-3 py-2 cursor-pointer font-medium text-brand-600 border-b border-neutral-100 ${
                  activeIndex === 0 ? "bg-brand-50" : ""
                }`}
              >
                + Crear nuevo producto
              </li>
            )}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-neutral-400">Sin resultados para "{query}"</li>
            )}
            {filtered.map((p, i) => {
              const index = i + offset;
              const isActive = activeIndex === index;
              return (
                <li
                  key={p._id}
                  role="option"
                  aria-selected={p._id === value}
                  data-active={isActive}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(index);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`px-3 py-2 cursor-pointer flex items-baseline justify-between gap-3 ${
                    isActive ? "bg-brand-50" : ""
                  } ${p._id === value ? "font-semibold" : ""}`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.sku && <span className="text-xs text-neutral-400 shrink-0">{p.sku}</span>}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
