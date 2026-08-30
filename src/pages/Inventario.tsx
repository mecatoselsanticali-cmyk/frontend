import { useEffect, useState } from "react";
import { adminApi } from "../services/api";
import ProductModal from "../components/ProductModal";
import StockModal from "../components/StockModal";
import Swal from "sweetalert2";
import { Hamburger, SquarePen, Trash, Trash2 } from "lucide-react";
import { useSelectedBranch } from "../layout/Layout";

export default function Inventario() {
  const [selectedBranch] = useSelectedBranch();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [stockProduct, setStockProduct] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const load = () => {
    setLoading(true);
    adminApi
      .listProducts({
        search: search || undefined,
        includeInactive: showInactive,
        branchId: selectedBranch || undefined,
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

  useEffect(load, [search, showInactive, selectedBranch, page]);

  // Cambiar de filtro (búsqueda, inactivos, o sede) debe volver a la
  // página 1 — si no, se podría quedar en una página que ya no existe
  // para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [search, showInactive, selectedBranch]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <input
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm w-full sm:w-72"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-500">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </div>
        <button
          onClick={openCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto"
        >
          + Nuevo producto
        </button>
      </div>

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
                <th className="p-3 whitespace-nowrap">Estado</th>
                <th className="p-3 whitespace-nowrap text-center sticky right-0 z-10 bg-neutral-50 border-l border-neutral-200">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-neutral-400">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-neutral-400">
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
                      <button
                        onClick={() => openEdit(p)}
                        className="text-brand-600 hover:underline text-xs font-medium"
                      >
                        <SquarePen size={20} />
                      </button>
                      {/**
                      <button
                        onClick={() => setStockProduct(p)}
                        className="text-neutral-600 hover:underline text-xs font-medium"
                      >
                        Stock
                      </button>
                      */}
                      {p.active ? (
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p._id}
                          className="text-red-500 hover:underline text-xs font-medium disabled:opacity-50"
                        >
                          {deletingId === p._id ? "Eliminando..." : <Trash2 size={20} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(p)}
                          disabled={deletingId === p._id}
                          className="text-green-600 hover:underline text-xs font-medium disabled:opacity-50"
                        >
                          {deletingId === p._id ? "Reactivando..." : "Reactivar"}
                        </button>
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
    </div>
  );
}
