import KpiCarousel from "../components/KpiCarousel";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminApi } from "../services/api";
import LogoLoader from "../components/LogoLoader";
import ProductModal from "../components/ProductModal";
import PurchaseModal from "../components/PurchaseModal";
import ManagedStockModal from "../components/ManagedStockModal";
import BulkStockModal from "../components/BulkStockModal";
import Swal from "sweetalert2";
import { Hamburger, LayersPlus, ShieldCheck, SquarePen, Trash2, Search, Upload, Plus, Package, PackageX, Wallet } from "lucide-react";
import { useSelectedBranch } from "../layout/Layout";
import { useAuthSession } from "../components/AuthProvider";

interface InventoryProduct {
  _id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  active: boolean;
  minStock: number;
  totalStock?: number;
  branchStock?: number;
  imageUrl?: string;
}

const money = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const productName = (value: string) => {
  const text = value.trim().toLocaleLowerCase("es-CO");
  return text.charAt(0).toLocaleUpperCase("es-CO") + text.slice(1);
};
const stockOf = (product: InventoryProduct, branch: string) => branch ? product.branchStock ?? 0 : product.totalStock ?? 0;

function StockStatus({ product, quantity }: { product: InventoryProduct; quantity: number }) {
  const [label, colors] = !product.active
    ? ["Inactivo", "border-zinc-200 bg-zinc-50 text-zinc-500"]
    : quantity <= 0 ? ["Agotado", "border-red-200 bg-red-50 text-red-700"]
    : quantity < product.minStock ? ["Bajo Stock", "border-amber-200 bg-amber-50 text-amber-700"]
    : ["En Stock", "border-emerald-200 bg-emerald-50 text-emerald-700"];
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}>{label}</span>;
}

function InventoryKpi({ label, value, icon: Icon, danger = false, loading }: {
  label: string; value: string; icon: typeof Package; danger?: boolean; loading: boolean;
}) {
  return <div className="h-full rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm md:rounded-xl md:p-5" aria-busy={loading}>
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-medium text-zinc-500">{label}</h2><Icon size={19} className={danger ? "text-red-400" : "text-zinc-400"} aria-hidden="true" /></div>
    <p className={`text-2xl font-bold tracking-tight tabular-nums ${danger ? "text-red-700" : "text-zinc-900"}`}>{loading ? "…" : value}</p>
  </div>;
}

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
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-white opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity z-20">
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
  // diferencia del top-up aditivo de PurchaseModal (que sí puede usar un
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
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(() => searchParams.get("lowStock") === "true");
  const [stockProduct, setStockProduct] = useState<any>(null);
  const [managedStockProduct, setManagedStockProduct] = useState<any>(null);
  // "Carga Masiva" (BulkStockModal, ver ese componente) — matriz producto x
  // sede para corregir stock de muchos productos a la vez. Mismo criterio
  // de permisos que ManagedStockModal (solo ADMIN, ver `isAdmin` arriba):
  // es la extensión multi-producto de esa misma herramienta.
  const [bulkStockModalOpen, setBulkStockModalOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [catalog, setCatalog] = useState<InventoryProduct[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = isMobile ? 5 : 8;

  const load = () => {
    setLoading(true);
    adminApi
      .listProducts({
        category: category || undefined,
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

  useEffect(load, [search, category, showInactive, lowStockOnly, selectedBranch, page, isMobile]);

  // Cambiar de filtro (búsqueda, inactivos, stock bajo, o sede) debe
  // volver a la página 1 — si no, se podría quedar en una página que ya
  // no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [search, category, showInactive, lowStockOnly, selectedBranch]);

  // Los KPI y las categorías usan el catálogo completo, no la página visible.
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(false);
    const collect = async () => {
      const all: InventoryProduct[] = [];
      let currentPage = 1;
      let lastPage = 1;
      do {
        const result = await adminApi.listProducts({ branchId: selectedBranch || undefined, includeInactive: true, page: currentPage, pageSize: 100 });
        all.push(...result.data);
        lastPage = result.totalPages;
        currentPage += 1;
      } while (currentPage <= lastPage && !cancelled);
      if (!cancelled) setCatalog(all);
    };
    collect().catch(() => { if (!cancelled) setSummaryError(true); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBranch, revision]);

  const refresh = () => { load(); setRevision((value) => value + 1); };
  const activeProducts = catalog.filter((product) => product.active);
  const exhausted = activeProducts.filter((product) => stockOf(product, selectedBranch) <= 0).length;
  const estimatedValue = activeProducts.reduce((sum, product) => sum + Math.max(0, stockOf(product, selectedBranch)) * product.price, 0);
  const categories = [...new Set(catalog.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

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
      refresh();
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
      refresh();
      Swal.fire({ title: "Producto reactivado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo reactivar el producto", icon: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setShowInactive(false);
    setLowStockOnly(false);
  };

  return (
    <div className="space-y-4">
      <section aria-label="Resumen de inventario" className="space-y-2">
        <KpiCarousel label="Métricas de inventario">
          <InventoryKpi label="Total Productos" value={summaryError ? "—" : activeProducts.length.toLocaleString("es-CO")} icon={Package} loading={summaryLoading} />
          <InventoryKpi label="Productos Agotados" value={summaryError ? "—" : exhausted.toLocaleString("es-CO")} icon={PackageX} danger loading={summaryLoading} />
          <InventoryKpi label="Valor Total Estimado del Inventario" value={summaryError ? "—" : money(estimatedValue)} icon={Wallet} loading={summaryLoading} />
        </KpiCarousel>
        <p className="text-xs text-zinc-500">Productos activos · {selectedBranch ? "Sede seleccionada" : "Todas las sedes"} · Valor estimado a precio de venta.</p>
        {summaryError && <p role="alert" className="text-xs text-red-600">No se pudo cargar el resumen. <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Reintentar</button></p>}
      </section>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="relative order-1 w-full md:min-w-0 md:flex-1 md:basis-56"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" /><input aria-label="Buscar por nombre o SKU" placeholder="Buscar por nombre o SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></div>
        <div className="order-2 flex w-full flex-col gap-2 md:order-4 md:w-auto md:flex-row">
          {isAdmin && !isMobile && <button type="button" onClick={() => setBulkStockModalOpen(true)} className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"><Upload size={16} aria-hidden="true" />Carga Masiva</button>}
          <button type="button" onClick={openCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:bg-orange-700 active:scale-[0.99] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 md:w-auto md:py-2"><Plus size={16} aria-hidden="true" />Nuevo producto</button>
        </div>
        <select aria-label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} className="order-3 w-full max-w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 md:order-2 md:w-auto"><option value="">Todas las categorías</option>{categories.map((value) => <option key={value} value={value}>{productName(value)}</option>)}</select>
        <div className="order-4 flex w-full items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:order-3 md:w-auto">
          <button type="button" aria-pressed={lowStockOnly} onClick={() => setLowStockOnly((value) => !value)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium active:border-orange-200 active:bg-orange-50 active:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${lowStockOnly ? "border-amber-200 bg-amber-50 text-amber-700" : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"}`}>Stock Bajo</button>
          <button type="button" aria-pressed={showInactive} title="Incluir productos inactivos" onClick={() => setShowInactive((value) => !value)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium active:border-orange-200 active:bg-orange-50 active:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${showInactive ? "border-orange-200 bg-orange-50 text-orange-700" : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"}`}>Inactivos</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-zinc-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="p-3 whitespace-nowrap">Foto</th>
                <th className="p-3 whitespace-nowrap">Nombre</th>
                <th className="p-3 whitespace-nowrap hidden sm:table-cell">SKU</th>
                <th className="p-3 whitespace-nowrap">Categoría</th>
                <th className="p-3 whitespace-nowrap text-right">Precio</th>
                <th className="p-3 whitespace-nowrap text-right">Stock</th>
                <th className="p-3 whitespace-nowrap text-right hidden sm:table-cell">Mín.</th>
                <th className="p-3 whitespace-nowrap">Estado</th>
                <th className="p-3 whitespace-nowrap text-center sticky right-0 z-10 bg-neutral-50 border-l border-neutral-200">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="p-10">
                    <div className="flex justify-center">
                      <LogoLoader size="sm" text="Cargando..." />
                    </div>
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-400">
                    <p>No hay productos que coincidan con los filtros.</p>
                    <button type="button" onClick={clearFilters} className="mt-3 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50">Limpiar filtros</button>
                  </td>
                </tr>
              )}
              {!loading && products.map((p) => (
                <tr key={p._id} className="group border-t border-zinc-100 hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Hamburger className="text-neutral-400" size={30} />
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium">{productName(p.name)}</td>
                  <td className="p-3 text-neutral-500 hidden sm:table-cell">{p.sku}</td>
                  <td className="p-3">{productName(p.category)}</td>
                  <td className="p-3 text-right tabular-nums">{money(p.price)}</td>
                  {/** <td className="p-3">{p.taxType}</td>*/}
                  <td className="p-3 text-right tabular-nums">
                    {(selectedBranch ? p.branchStock ?? 0 : p.totalStock ?? 0).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 text-right tabular-nums text-neutral-400 hidden sm:table-cell">
                    {p.minStock > 0 ? p.minStock.toLocaleString("es-CO") : "—"}
                  </td>
                  <td className="p-3">
                    <StockStatus product={p} quantity={stockOf(p, selectedBranch)} />
                  </td>
                  <td className="p-3 sticky right-0 z-10 bg-white group-hover:bg-zinc-50 border-l border-zinc-200 transition-colors">
                    <div className="flex justify-center gap-3">
                      <IconTooltipButton
                        label="Editar"
                        onClick={() => openEdit(p)}
                        className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                      >
                        <SquarePen size={20} />
                      </IconTooltipButton>
                      {isAdmin && (
                        <IconTooltipButton
                          label="Manejar inventario"
                          onClick={() => setManagedStockProduct(p)}
                          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                        >
                          <LayersPlus size={20}/>
                        </IconTooltipButton>
                      )}
                      {p.active ? (
                        <IconTooltipButton
                          label="Desactivar"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p._id}
                          className=" rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          {deletingId === p._id ? "Eliminando..." : <Trash2 size={20} />}
                        </IconTooltipButton>
                      ) : (
                        <IconTooltipButton
                          label="Reactivar"
                          onClick={() => handleReactivate(p)}
                          disabled={deletingId === p._id}
                          className=" rounded-md p-1 text-zinc-400 transition-colors hover:bg-green-50 hover:text-green-600"
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
          onSaved={refresh}
        />
      )}

      {stockProduct && (
        <PurchaseModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSaved={refresh}
        />
      )}

      {managedStockProduct && (
        <ManagedStockModal
          product={managedStockProduct}
          onClose={() => setManagedStockProduct(null)}
          onSaved={refresh}
        />
      )}

      {bulkStockModalOpen && (
        <BulkStockModal onClose={() => setBulkStockModalOpen(false)} onSaved={refresh} />
      )}
    </div>
  );
}
