import { useEffect, useMemo } from "react";
import { usePosStore } from "../store/posStore";
import { posApi } from "../services/posApi";
import { offlineDb } from "../db/offlineDb";

export default function CategoryMenu() {
  const products = usePosStore((s) => s.products);
  const setProducts = usePosStore((s) => s.setProducts);
  const activeCategory = usePosStore((s) => s.activeCategory);
  const setActiveCategory = usePosStore((s) => s.setActiveCategory);
  const addToOrder = usePosStore((s) => s.addToOrder);

  // Carga el catálogo: intenta red primero, cae a caché local (Dexie) si está offline
  useEffect(() => {
    async function loadCatalog() {
      try {
        const fresh = await posApi.getCatalog();
        setProducts(fresh);
        await offlineDb.products.clear();
        await offlineDb.products.bulkPut(fresh);
      } catch {
        const cached = await offlineDb.products.toArray();
        setProducts(cached);
      }
    }
    loadCatalog();
  }, [setProducts]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))),
    [products]
  );

  const visibleProducts = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products;

  // Un producto ya agregado a la orden se deshabilita en el grid — la
  // cantidad de ahí en adelante solo se ajusta desde OrderPanel (+/-),
  // no volviendo a tocar el ícono (que antes agregaba una línea nueva
  // separada por cada click, en vez de sumar a la existente).
  const order = usePosStore((s) => s.order);
  const productIdsInOrder = useMemo(
    () => new Set(order.map((line) => line.productId)),
    [order]
  );

  return (
    <div className="w-[38%] h-full flex flex-col bg-neutral-100 border-r border-neutral-200">
      {/* Tabs de categorías */}
      <div className="flex gap-2 p-3 overflow-x-auto border-b border-neutral-200 bg-white">
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

      {/* Grid de productos con foto */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-3 content-start">
        {visibleProducts.map((product) => {
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
    </div>
  );
}
