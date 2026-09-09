import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "../services/api";
import ProductModal from "../components/ProductModal";
import StockModal from "../components/StockModal";
import ManagedStockModal from "../components/ManagedStockModal";
import MoreFiltersModal from "../components/MoreFiltersModal";
import Swal from "sweetalert2";
import { Hamburger, LayersPlus, ShieldCheck, SquarePen, Trash, Trash2, Warehouse } from "lucide-react";
import { useSelectedBranch } from "../layout/Layout";
import { useAuthSession } from "../components/AuthProvider";

// El atributo HTML `title` (lo que se usaba antes acá) depende por completo
// del navegador/SO para decidir SI aparece y cuándo — en la práctica es
// inconsistente (delay largo y variable, algunos navegadores/config de
// accesibilidad lo suprimen del todo) y varios usuarios reportaron que
// simplemente no se veía. Este tooltip es CSS puro (`group`/`group-hover`
// de Tailwind), bajo control total de este componente, no del navegador —
// aparece siempre igual, sin depender de nada externo.
function IconTooltipButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group/tooltip">
      <button onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-white opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-20">
        {label}
      </span>
    </div>
  );
}

// Misma "propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// Topbar.tsx/CashierLayout.tsx — no hay un hook compartido para esto en
// el proyecto (ver punto 36 de CLAUDE.md). Acá decide el `pageSize` de la
// paginación: 5 filas por página en celular en vez de las 20 de
// escritorio, para que "Anterior"/"Siguiente" no obligue a hacer scroll
// vertical largo en una pantalla angosta.
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

export default function Inventario() {
  const isMobile = useIsMobile();
  const [selectedBranch] = useSelectedBranch();
  const { admin } = useAuthSession();
  // Gestión directa de stock (ManagedStockModal, ver punto 60 de
  // admin-frontend/CLAUDE.md) es exclusiva de ADMIN — nunca de MANAGER, a
  // diferencia del top-up aditivo de StockModal (que sí puede usar un
  // gerente). Ocultar el botón acá es solo la primera capa; el backend
  // (`requireRole("ADMIN")` en `PUT /products/:id/stock`) es la que de
  // verdad lo hace cumplir, ver punto 20 de este mismo archivo.
  const isAdmin = admin?.role === "ADMIN";
  // CTA "Ir a Inventario" del widget de Stock Crítico del Dashboard (ver
  // punto 62 de CLAUDE.md) — llega acá como `/inventario?lowStock=true`,
  // leído una sola vez al montar para prender el filtro de arranque. Es
  // un `useState` normal, no queda atado al query param después (tocar el
  // checkbox no reescribe la URL) — mismo criterio simple que el resto de
  // los filtros de esta página, todos en estado local, ninguno sincronizado
  // con la URL hoy.
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(() => searchParams.get("lowStock") === "true");
  const [stockProduct, setStockProduct] = useState<any>(null);
  const [managedStockProduct, setManagedStockProduct] = useState<any>(null);
  // Modal "Más filtros" de la vista de celular (ver punto 63 de CLAUDE.md)
  // — solo `search` queda visible fuera del modal; "Mostrar inactivos"/
  // "Solo stock bajo" viven adentro.
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = isMobile ? 5 : 20;

  const load = () => {
    setLoading(true);
    adminApi
      .listProducts({
        search: search || undefined,
        includeInactive: showInactive,
        branchId: selectedBranch || undefined,
        lowStockOnly: lowStockOnly || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setProducts(res.data);
        setTotalPages(res.totalPages);
        setTotal(res.total);
        // Si una eliminación dejó la página actual vacía (ej. era el único
        // producto de la última página), retrocede a la última página real.
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [search, showInactive, lowStockOnly, selectedBranch, page, isMobile]);

  // Cambiar de filtro (búsqueda, inactivos, stock bajo, o sede) debe
  // volver a la página 1 — si no, se podría quedar en una página que ya
  // no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [search, showInactive, lowStockOnly, selectedBranch]);

  const openCreate = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleDelete = async (product: any) => {
    const result = await Swal.fire({
      title: `¿Eliminar "${product.name}"?`,
      text: "Dejará de estar disponible en el POS. Se puede reactivar luego.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    setDeletingId(product._id);
    try {
      await adminApi.deleteProduct(product._id);
      load();
      Swal.fire({ title: "Producto eliminado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo eliminar el producto", icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleReactivate = async (product: any) => {
    setDeletingId(product._id);
    try {
      await adminApi.updateProduct(product._id, { active: true });
      load();
      Swal.fire({ title: "Producto reactivado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo reactivar el producto", icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const extraFiltersCount = [showInactive, lowStockOnly].filter(Boolean).length;

  // "Limpiar filtros" del modal "Más filtros" (ver punto 63 de CLAUDE.md)
  // — resetea TODOS los filtros de esta página, incluido `search` (vive
  // fuera del modal en la barra compacta de celular).
  const clearFilters = () => {
    setSearch("");
    setShowInactive(false);
    setLowStockOnly(false);
  };

  return (
    <div className="space-y-4">
      {!isMobile && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <input
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base w-full sm:w-72"
            />
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostrar inactivos
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              Solo stock bajo
            </label>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto"
          >
            + Nuevo producto
          </button>
        </div>
      )}

      {/* Vista de celular (ver punto 63 de CLAUDE.md) — solo el buscador
          queda visible junto al botón "Más filtros"; los dos checkboxes
          viven en el modal. */}
      {isMobile && (
        <>
          <div className="flex gap-2">
            <input
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
            <button
              onClick={() => setFiltersModalOpen(true)}
              className="relative shrink-0 px-3 py-2 rounded-lg text-sm font-medium border bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            >
              Más filtros
              {extraFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {extraFiltersCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={openCreate}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full"
          >
            + Nuevo producto
          </button>
        </>
      )}

      {filtersModalOpen && (
        <MoreFiltersModal onClose={() => setFiltersModalOpen(false)} onClear={clearFilters}>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Solo stock bajo
          </label>
        </MoreFiltersModal>
      )}

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="p-3 whitespace-nowrap">Foto</th>
                <th className="p-3 whitespace-nowrap">Nombre</th>
                <th className="p-3 whitespace-nowrap hidden sm:table-cell">SKU</th>
                <th className="p-3 whitespace-nowrap">Categoría</th>
                <th className="p-3 whitespace-nowrap">Precio</th>
                {/**
                <th className="p-3">Impuesto</th>*/}
                <th className="p-3 whitespace-nowrap">Stock</th>
                <th className="p-3 whitespace-nowrap hidden sm:table-cell">Mín.</th>
                <th className="p-3 whitespace-nowrap">Estado</th>
                <th className="p-3 whitespace-nowrap text-center sticky right-0 z-10 bg-neutral-50 border-l border-neutral-200">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-400">
                    No hay productos registrados
                  </td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p._id} className="border-t border-neutral-50 hover:bg-neutral-50">
                  <td className="p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Hamburger className="text-neutral-400" size={30} />
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-neutral-500 hidden sm:table-cell">{p.sku}</td>
                  <td className="p-3">{p.category}</td>
                  <td className="p-3">${p.price.toLocaleString("es-CO")}</td>
                  {/** <td className="p-3">{p.taxType}</td>*/}
                  <td className="p-3">
                    {(selectedBranch ? p.branchStock ?? 0 : p.totalStock ?? 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-neutral-400 hidden sm:table-cell">
                    {p.minStock > 0 ? p.minStock.toLocaleString("es-CO") : "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        p.active ? "bg-green-50 text-green-600" : "bg-neutral-100 text-neutral-400"
                      }`}
                    >
                      {p.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="p-3 sticky right-0 z-10 bg-white border-l border-neutral-200">
                    <div className="flex justify-center gap-3">
                      <IconTooltipButton
                        label="Editar"
                        onClick={() => openEdit(p)}
                        className="rounded-md text-orange-600 transition-colors hover:bg-orange-50 hover:text-orange-700"
                      >
                        <SquarePen size={20} />
                      </IconTooltipButton>
                      {isAdmin && (
                        <IconTooltipButton
                          label="Manejar inventario"
                          onClick={() => setManagedStockProduct(p)}
                          className="rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <LayersPlus size={20}/>
                        </IconTooltipButton>
                      )}
                      {p.active ? (
                        <IconTooltipButton
                          label="Desactivar"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p._id}
                          className=" rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          {deletingId === p._id ? "Eliminando..." : <Trash2 size={20} />}
                        </IconTooltipButton>
                      ) : (
                        <IconTooltipButton
                          label="Reactivar"
                          onClick={() => handleReactivate(p)}
                          disabled={deletingId === p._id}
                          className=" rounded-md text-green-500 transition-colors hover:bg-green-50 hover:text-green-600"
                        >
                          {deletingId === p._id ? "Reactivando..." : <ShieldCheck size={20} />}
                        </IconTooltipButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} producto{total === 1 ? "" : "s"} · página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

      {stockProduct && (
        <StockModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSaved={load}
        />
      )}

      {managedStockProduct && (
        <ManagedStockModal
          product={managedStockProduct}
          onClose={() => setManagedStockProduct(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
