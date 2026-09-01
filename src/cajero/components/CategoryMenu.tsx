import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePosStore } from "../store/posStore";
import { posApi } from "../services/posApi";
import { offlineDb } from "../db/offlineDb";

const PAGE_SIZE = 24;

export default function CategoryMenu() {
  const products = usePosStore((s) => s.products);
  const setProducts = usePosStore((s) => s.setProducts);
  const activeCategory = usePosStore((s) => s.activeCategory);
  const setActiveCategory = usePosStore((s) => s.setActiveCategory);
  const addToOrder = usePosStore((s) => s.addToOrder);
  const order = usePosStore((s) => s.order);

  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Buscar o cambiar de categoría siempre vuelve a la página 1 — mismo
  // criterio que los filtros paginados del panel admin (ver punto 22/36 de
  // admin-frontend/CLAUDE.md).
  useEffect(() => {
    setPage(1);
  }, [search, activeCategory]);

  // Carga UNA página del catálogo desde el backend (filtrada por
  // categoría/búsqueda, ver punto 46 de CLAUDE.md) — intenta red primero,
  // cae a caché local (Dexie) si está offline. A diferencia del diseño
  // anterior (traía TODO el catálogo una sola vez y filtraba/paginaba en
  // el cliente), ahora la paginación y el filtro corren en el backend
  // (GET /api/pos/catalog en posController.ts).
  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const res = await posApi.getCatalog({
          page,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          category: activeCategory || undefined,
        });
        if (cancelled) return;
        setProducts(res.data);
        setCategories(res.categories);
        setTotalPages(res.totalPages);
        // Acumula en la caché offline (upsert, nunca `clear()`) — cada
        // fetch exitoso solo trae UNA página; borrar el resto tiraría el
        // resto del catálogo ya cacheado de páginas/búsquedas anteriores
        // de esta misma sesión.
        await offlineDb.products.bulkPut(res.data);
      } catch {
        if (cancelled) return;
        // Sin red: filtra/pagina a mano sobre lo que haya en Dexie de
        // fetches anteriores — mejor que nada, aunque no sea
        // necesariamente el catálogo completo de la sede.
        const cachedAll = await offlineDb.products.toArray();
        const term = search.trim().toLowerCase();
        const filtered = cachedAll.filter((p) => {
          const matchesCategory = !activeCategory || p.category === activeCategory;
          const matchesSearch =
            !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
          return matchesCategory && matchesSearch;
        });
        setCategories(Array.from(new Set(cachedAll.map((p) => p.category))).sort());
        setTotalPages(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
        setProducts(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      }
    }

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [page, search, activeCategory, setProducts]);

  // Un producto ya agregado a la orden se deshabilita en el grid — la
  // cantidad de ahí en adelante solo se ajusta desde OrderPanel (+/-),
  // no volviendo a tocar el ícono (que antes agregaba una línea nueva
  // separada por cada click, en vez de sumar a la existente).
  const productIdsInOrder = useMemo(
    () => new Set(order.map((line) => line.productId)),
    [order]
  );

  return (
    <div className="w-[38%] h-full flex flex-col bg-neutral-100 border-r border-neutral-200">
      {/* Tabs de categorías + buscador (al final de la misma línea) */}
      <div className="flex items-center gap-2 p-3 border-b border-neutral-200 bg-white">
        {/* `min-w-0` es necesario: sin esto, un hijo flex no se encoge
            debajo de su ancho de contenido (default `min-width: auto`),
            así que `overflow-x-auto` nunca llega a activarse y esta fila
            termina empujando/recortando el buscador en vez de scrollear
            sus propias tabs cuando no caben todas. */}
        <div className="flex gap-2 overflow-x-auto min-w-0">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeCategory === null ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeCategory === cat ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative ml-auto shrink-0 w-40">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-full bg-neutral-100 border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Grid de productos con foto */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-3 content-start">
        {products.length === 0 && (
          <p className="col-span-3 text-center text-sm text-neutral-400 py-8">
            No se encontraron productos
          </p>
        )}
        {products.map((product) => {
          const inOrder = productIdsInOrder.has(product._id);
          return (
            <button
              key={product._id}
              onClick={() => addToOrder(product)}
              disabled={inOrder}
              title={
                inOrder
                  ? "Ya está en la orden — ajusta la cantidad desde el panel de la orden"
                  : undefined
              }
              className={`bg-white rounded-xl shadow-sm transition-all overflow-hidden text-left ${
                inOrder ? "opacity-50 cursor-not-allowed" : "hover:shadow-md active:scale-95"
              }`}
            >
              <div className="aspect-square bg-neutral-200">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-3xl">
                    🍞
                  </div>
                )}
              </div>
              <div className="p-2">
                <div className="text-sm font-medium truncate">{product.name}</div>
                <div className="text-brand-700 font-bold text-sm">
                  ${product.price.toLocaleString("es-CO")}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-200 bg-white text-sm shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 font-medium"
          >
            Anterior
          </button>
          <span className="text-neutral-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 font-medium"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
