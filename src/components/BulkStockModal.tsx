import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Search } from "lucide-react";
import { adminApi } from "../services/api";

interface Product {
  _id: string;
  name: string;
  sku: string;
}

interface Branch {
  _id: string;
  name: string;
}

interface BulkStockModalProps {
  onClose: () => void;
  onSaved: () => void;
}

/**
 * "Carga Masiva" — matriz producto x sede para corregir stock de MUCHOS
 * productos de una sola vez, sin abrir `ManagedStockModal.tsx` uno por
 * uno. Misma semántica $set exacta que ese modal (`PUT
 * /products/stock/bulk`, solo ADMIN — ver ese endpoint y el botón que
 * abre esto en `Inventario.tsx`), no aditiva. No reemplaza
 * `ManagedStockModal.tsx`/`StockModal.tsx` — sigue siendo más rápido
 * corregir un solo producto desde ahí; esto es para revisar/ajustar
 * varios de una.
 *
 * Solo manda al backend las celdas que el admin realmente tocó
 * (`edits`), no la grilla completa — así una edición concurrente de otro
 * admin en una celda que nadie tocó acá no se pisa sin querer.
 */
export default function BulkStockModal({ onClose, onSaved }: BulkStockModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Snapshot original tal como vino del backend al abrir el modal — se usa
  // para decidir si una celda "cambió" (compara contra esto, no contra 0).
  const [originalStock, setOriginalStock] = useState<Record<string, Record<string, number>>>({});
  // Solo las celdas que el admin tocó — clave "productId:branchId".
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .getStockMatrix()
      .then((data) => {
        setProducts(data.products);
        setBranches(data.branches);
        setOriginalStock(data.stock);
      })
      .catch((err: any) => setError(err.message || "No se pudo cargar el inventario"))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
  }, [products, search]);

  const cellKey = (productId: string, branchId: string) => `${productId}:${branchId}`;

  const originalQuantity = (productId: string, branchId: string) =>
    originalStock[productId]?.[branchId] ?? 0;

  const cellValue = (productId: string, branchId: string) => {
    const key = cellKey(productId, branchId);
    return key in edits ? edits[key] : originalQuantity(productId, branchId);
  };

  const isDirty = (productId: string, branchId: string) => {
    const key = cellKey(productId, branchId);
    return key in edits && edits[key] !== originalQuantity(productId, branchId);
  };

  const updateCell = (productId: string, branchId: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const key = cellKey(productId, branchId);
    if (digits === "") {
      // Campo vacío mientras se edita — no se guarda como 0 todavía, se
      // trata como "sin tocar" hasta que escriba algo (mismo criterio que
      // dejar el input vacío en vez de forzar un 0 prematuro).
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setEdits((prev) => ({ ...prev, [key]: Number(digits) }));
  };

  const editedCount = Object.keys(edits).filter((key) => {
    const [productId, branchId] = key.split(":");
    return isDirty(productId, branchId);
  }).length;

  const submit = async () => {
    const updates = Object.entries(edits)
      .filter(([key]) => {
        const [productId, branchId] = key.split(":");
        return isDirty(productId, branchId);
      })
      .map(([key, quantity]) => {
        const [productId, branchId] = key.split(":");
        return { productId, branchId, quantity };
      });

    if (updates.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");
    try {
      await adminApi.bulkSetProductStock(updates);
      Swal.fire({ title: "Inventario actualizado", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la carga masiva");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[85vh] shadow-xl flex flex-col">
        <div className="p-6 pb-4 border-b border-neutral-100 flex items-start justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold">Asignación Masiva de Inventario</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Corrige el stock de varios productos y sedes a la vez — reemplaza directamente la cantidad
              registrada, igual que "Gestionar stock" pero para muchos productos de una.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-neutral-400 hover:text-neutral-600 text-xl leading-none shrink-0 ml-4"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-3 border-b border-neutral-100 shrink-0">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6">
          {loading ? (
            <p className="text-sm text-neutral-400 py-8 text-center">Cargando inventario...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-neutral-400 py-8 text-center">No hay productos activos</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-xs text-neutral-400 border-b border-neutral-200">
                  <th className="text-left font-medium py-2 pr-3 sticky left-0 bg-white w-20">SKU</th>
                  <th className="text-left font-medium py-2 pr-3 sticky left-20 bg-white">Producto</th>
                  {branches.map((b) => (
                    <th key={b._id} className="text-center font-medium py-2 px-2 whitespace-nowrap">
                      {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p._id} className="border-b border-neutral-50">
                    <td className="py-1.5 pr-3 text-xs text-neutral-500 font-mono sticky left-0 bg-white w-20">
                      {p.sku}
                    </td>
                    <td className="py-1.5 pr-3 sticky left-20 bg-white truncate max-w-[220px]">{p.name}</td>
                    {branches.map((b) => {
                      const dirty = isDirty(p._id, b._id);
                      return (
                        <td key={b._id} className="py-1.5 px-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cellValue(p._id, b._id)}
                            onChange={(e) => updateCell(p._id, b._id, e.target.value)}
                            className={`w-20 mx-auto block border rounded-lg p-1.5 text-center text-sm ${
                              dirty ? "border-brand-500 bg-brand-50 font-semibold" : "border-neutral-200"
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={2 + branches.length} className="text-center text-neutral-400 py-6">
                      Ningún producto coincide con "{search}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-6 pt-4 border-t border-neutral-100 shrink-0 space-y-2">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-400">
              {editedCount > 0 ? `${editedCount} celda(s) modificada(s)` : "Sin cambios todavía"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={saving || loading}
                className="px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
