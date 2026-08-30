import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import ProductModal from "./ProductModal";
import BranchModal from "./BranchModal";
import { Plus, Trash2 } from "lucide-react";

const NEW_PRODUCT_OPTION = "__new__";
const NEW_BRANCH_OPTION = "__new__";

interface BranchStock {
  branchId: string;
  branchName: string;
  quantity: number;
}

interface PurchaseItem {
  productId: string;
  amount: string;
  quantity: string;
}

interface PurchaseBranchEntry {
  branchId: string;
  items: PurchaseItem[];
}

const emptyPurchaseItem = (): PurchaseItem => ({ productId: "", amount: "", quantity: "" });

interface StockModalProps {
  product?: any; // si viene, el producto queda fijo (se abre desde Inventario)
  onClose: () => void;
  onSaved: () => void;
}

export default function StockModal({ product, onClose, onSaved }: StockModalProps) {
  // Modo "compra" (sin producto fijo, abierto desde Compras): a diferencia
  // del modo de abajo (un solo producto, repartido por sede), acá se arma
  // una orden que puede cubrir varias sedes y, dentro de cada una, varios
  // productos — cada combinación (sede, producto) se registra como un
  // Purchase independiente (ver submitPurchase), reutilizando el mismo
  // POST /api/admin/purchases sin cambios en el backend.
  const isPurchaseMode = !product;

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(isPurchaseMode);
  // Solo se lee — en modo compra ya no hay un único producto seleccionable
  // (cada fila tiene el suyo, ver branchEntries) y en modo top-up el
  // producto viene fijo por props, nunca cambia tras montar el modal.
  const [selectedProductId] = useState<string>(product?._id || "");

  const [branchStocks, setBranchStocks] = useState<BranchStock[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const [supplierName, setSupplierName] = useState("");
  const [concept, setConcept] = useState("");

  // --- Estado exclusivo del modo compra ---
  const [branches, setBranches] = useState<any[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(isPurchaseMode);
  const [branchEntries, setBranchEntries] = useState<PurchaseBranchEntry[]>([
    { branchId: "", items: [] },
  ]);
  const [creatingProductFor, setCreatingProductFor] = useState<
    { branchIndex: number; itemIndex: number } | null
  >(null);
  const [creatingBranchFor, setCreatingBranchFor] = useState<number | null>(null);
  // Un GERENTE solo puede comprar para su propia sede (ver punto 18 de
  // CLAUDE.md) — se detecta acá para fijar branchEntries a esa única sede
  // y ocultar la posibilidad de elegir o agregar otra (el backend también
  // lo rechaza si de todos modos llegara otra sede, ver createPurchaseAdmin).
  const [currentAdmin, setCurrentAdmin] = useState<{ role: string; branchId?: string } | null>(null);
  const isManager = currentAdmin?.role === "MANAGER";

  // Catálogo de productos (para elegir qué se está comprando), sedes (para
  // elegir dónde queda el stock) y el admin actual — todos con
  // pageSize:100 donde aplica porque acá se necesita "todo", no una página
  // (ver punto 15 de CLAUDE.md).
  useEffect(() => {
    if (!isPurchaseMode) return;
    adminApi
      .listProducts({ pageSize: 100 })
      .then((res) => setProducts(res.data))
      .catch((err: any) => setError(err.message || "No se pudo cargar el catálogo"))
      .finally(() => setLoadingProducts(false));
    adminApi
      .listBranches({ pageSize: 100 })
      .then((res) => setBranches(res.data))
      .catch((err: any) => setError(err.message || "No se pudieron cargar las sedes"))
      .finally(() => setLoadingBranches(false));
    adminApi.me().catch(() => null).then((me) => me && setCurrentAdmin(me));
  }, [isPurchaseMode]);

  // Apenas se sabe que es gerente, fija su única fila de sede a su propia
  // sede — no depende de que `branches` ya haya cargado.
  useEffect(() => {
    if (isManager && currentAdmin?.branchId) {
      updateBranchEntry(0, currentAdmin.branchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, currentAdmin?.branchId]);

  useEffect(() => {
    if (!selectedProductId) {
      setBranchStocks([]);
      return;
    }
    setLoadingStock(true);
    setAllocations({});
    setQuantityToAdd("");
    adminApi
      .getProductStock(selectedProductId)
      .then((data) => setBranchStocks(data.branchStocks))
      .catch((err: any) => setError(err.message || "No se pudo cargar el stock"))
      .finally(() => setLoadingStock(false));
  }, [selectedProductId]);

  const selectedProduct = product || products.find((p) => p._id === selectedProductId);

  const currentTotal = branchStocks.reduce((sum, b) => sum + b.quantity, 0);
  const allocated = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const totalQuantity = Number(quantityToAdd) || 0;
  const remaining = totalQuantity - allocated;

  const updateAllocation = (branchId: string, value: string) => {
    setAllocations({ ...allocations, [branchId]: value });
  };

  // --- Helpers del modo compra: array de sedes, cada una con su array de ítems ---
  const addBranchEntry = () => setBranchEntries([...branchEntries, { branchId: "", items: [] }]);

  const removeBranchEntry = (branchIndex: number) =>
    setBranchEntries(branchEntries.filter((_, i) => i !== branchIndex));

  const updateBranchEntry = (branchIndex: number, branchId: string) => {
    setBranchEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== branchIndex) return entry;
        // Al elegir la sede por primera vez, ya aparece una fila de
        // producto lista para llenar — no hace falta un click extra.
        const items = entry.items.length > 0 ? entry.items : [emptyPurchaseItem()];
        return { branchId, items };
      })
    );
  };

  const addItem = (branchIndex: number) => {
    setBranchEntries((prev) =>
      prev.map((entry, i) =>
        i === branchIndex ? { ...entry, items: [...entry.items, emptyPurchaseItem()] } : entry
      )
    );
  };

  const removeItem = (branchIndex: number, itemIndex: number) => {
    setBranchEntries((prev) =>
      prev.map((entry, i) =>
        i === branchIndex ? { ...entry, items: entry.items.filter((_, j) => j !== itemIndex) } : entry
      )
    );
  };

  const updateItem = (branchIndex: number, itemIndex: number, patch: Partial<PurchaseItem>) => {
    setBranchEntries((prev) =>
      prev.map((entry, i) =>
        i === branchIndex
          ? { ...entry, items: entry.items.map((it, j) => (j === itemIndex ? { ...it, ...patch } : it)) }
          : entry
      )
    );
  };

  // Cada (sede, producto) con cantidad y monto válidos se vuelve un
  // Purchase independiente al enviar — así una misma orden puede cubrir
  // varias sedes y varios productos por sede sin inventar un modelo nuevo.
  const flatPurchaseItems = branchEntries
    .filter((entry) => entry.branchId)
    .flatMap((entry) =>
      entry.items
        .filter((it) => it.productId && Number(it.quantity) > 0 && Number(it.amount) > 0)
        .map((it) => ({
          branchId: entry.branchId,
          productId: it.productId,
          quantity: Number(it.quantity),
          amount: Number(it.amount),
        }))
    );

  const canSubmitPurchase = Boolean(supplierName) && flatPurchaseItems.length > 0;
  const canSubmitStockTopUp = Boolean(selectedProductId) && totalQuantity > 0 && remaining === 0;

  const submitPurchase = async () => {
    if (!supplierName) {
      setError("El proveedor es requerido");
      return;
    }
    if (flatPurchaseItems.length === 0) {
      setError("Agrega al menos un producto con cantidad y monto por sede");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await Promise.all(
        flatPurchaseItems.map((it) =>
          adminApi.createPurchase({
            productId: it.productId,
            supplierName,
            concept: concept || undefined,
            amount: it.amount,
            allocations: [{ branchId: it.branchId, quantity: it.quantity }],
          })
        )
      );
      Swal.fire({ title: "Compra registrada", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const submitStockTopUp = async () => {
    if (!selectedProductId) {
      setError("Selecciona el producto que estás comprando");
      return;
    }
    if (totalQuantity <= 0) {
      setError("Ingresa la cantidad total a agregar");
      return;
    }
    if (remaining !== 0) {
      setError("La suma asignada a las sedes debe ser igual a la cantidad total");
      return;
    }

    const branchAllocations = Object.entries(allocations)
      .map(([branchId, quantity]) => ({ branchId, quantity: Number(quantity) || 0 }))
      .filter((a) => a.quantity > 0);

    setSaving(true);
    setError("");
    try {
      await adminApi.addProductStock(selectedProductId, branchAllocations);
      Swal.fire({ title: "Stock actualizado", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const submit = () => (isPurchaseMode ? submitPurchase() : submitStockTopUp());

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">
                {isPurchaseMode ? "Nueva compra" : `Stock de ${selectedProduct.name}`}
              </h3>
              {!isPurchaseMode && (
                <p className="text-xs text-neutral-400">
                  Stock actual total: {currentTotal.toLocaleString("es-CO")} unidades
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {isPurchaseMode && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-500">Proveedor</label>
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                  placeholder="Ej. Distribuidora XYZ"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500">Concepto (opcional)</label>
                <input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                  placeholder="Ej. Compra de insumos de la semana"
                />
              </div>

              {loadingProducts || loadingBranches ? (
                <p className="text-sm text-neutral-400">Cargando catálogo y sedes...</p>
              ) : (
                <div className="space-y-3">
                  {branchEntries.map((entry, branchIndex) => {
                    const usedElsewhere = branchEntries
                      .filter((_, i) => i !== branchIndex)
                      .map((e) => e.branchId);
                    const branchOptions = branches.filter(
                      (b) => b._id === entry.branchId || !usedElsewhere.includes(b._id)
                    );

                    return (
                      <div key={branchIndex} className="border border-neutral-200 rounded-xl p-3 space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-xs text-neutral-500">Sede</label>
                            {isManager ? (
                              // Un gerente ya está fijado a su propia sede — se
                              // muestra como texto fijo, sin `<select>`, igual
                              // que el patrón de Topbar.tsx (ver punto 18 de
                              // CLAUDE.md), para que ni siquiera tenga la
                              // opción visual de cambiarla.
                              <p className="w-full border border-neutral-100 bg-neutral-50 rounded-lg p-2 text-sm mt-1 text-neutral-600">
                                {branches.find((b) => b._id === entry.branchId)?.name || "Tu sede"}
                              </p>
                            ) : (
                              <select
                                value={entry.branchId}
                                onChange={(e) => {
                                  if (e.target.value === NEW_BRANCH_OPTION) {
                                    setCreatingBranchFor(branchIndex);
                                    return;
                                  }
                                  updateBranchEntry(branchIndex, e.target.value);
                                }}
                                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                              >
                                <option value="">Selecciona una sede</option>
                                <option value={NEW_BRANCH_OPTION}>+ Crear nueva sede</option>
                                {branchOptions.map((b) => (
                                  <option key={b._id} value={b._id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          {!isManager && (
                            <button
                              type="button"
                              onClick={() => removeBranchEntry(branchIndex)}
                              disabled={branchEntries.length === 1}
                              className="text-neutral-400 hover:text-red-500 disabled:opacity-30 p-2"
                              aria-label="Quitar sede"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>

                        {entry.branchId && (
                          <div className="space-y-2">
                            {entry.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex items-start gap-2">
                                <div className="flex-1">
                                  <select
                                    value={item.productId}
                                    onChange={(e) => {
                                      if (e.target.value === NEW_PRODUCT_OPTION) {
                                        setCreatingProductFor({ branchIndex, itemIndex });
                                        return;
                                      }
                                      updateItem(branchIndex, itemIndex, { productId: e.target.value });
                                    }}
                                    className="w-full border border-neutral-200 rounded-lg p-2 text-sm"
                                  >
                                    <option value="">Selecciona un producto</option>
                                    <option value={NEW_PRODUCT_OPTION}>+ Crear nuevo producto</option>
                                    {products.map((p) => (
                                      <option key={p._id} value={p._id}>
                                        {p.name} ({p.sku})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.amount}
                                  onChange={(e) => updateItem(branchIndex, itemIndex, { amount: e.target.value })}
                                  placeholder="Monto pagado"
                                  className="w-28 border border-neutral-200 rounded-lg p-2 text-sm"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  value={item.quantity}
                                  onChange={(e) => updateItem(branchIndex, itemIndex, { quantity: e.target.value })}
                                  placeholder="Cantidad"
                                  className="w-24 border border-neutral-200 rounded-lg p-2 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeItem(branchIndex, itemIndex)}
                                  disabled={entry.items.length === 1}
                                  className="text-neutral-400 hover:text-red-500 disabled:opacity-30 p-2"
                                  aria-label="Quitar producto"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addItem(branchIndex)}
                              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                            >
                              <Plus size={14} />
                              Agregar producto
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!isManager && (
                    <button
                      type="button"
                      onClick={addBranchEntry}
                      className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      <Plus size={14} />
                      Agregar otra sede
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!isPurchaseMode &&
            selectedProductId &&
            (loadingStock ? (
              <p className="text-sm text-neutral-400">Cargando stock...</p>
            ) : (
              <>
                <div>
                  <label className="text-xs text-neutral-500">Cantidad total a agregar</label>
                  <input
                    type="number"
                    min={0}
                    value={quantityToAdd}
                    onChange={(e) => setQuantityToAdd(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                    placeholder="Ej. 100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-neutral-500">Asignar por sede</label>
                    <span
                      className={`text-xs font-medium ${
                        remaining === 0 && totalQuantity > 0 ? "text-green-600" : "text-neutral-400"
                      }`}
                    >
                      Restante por asignar: {remaining.toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {branchStocks.map((b) => (
                      <div key={b.branchId} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{b.branchName}</p>
                          <p className="text-xs text-neutral-400">
                            Actual: {b.quantity.toLocaleString("es-CO")}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={allocations[b.branchId] || ""}
                          onChange={(e) => updateAllocation(b.branchId, e.target.value)}
                          className="w-28 border border-neutral-200 rounded-lg p-2 text-sm"
                          placeholder="0"
                        />
                      </div>
                    ))}
                    {branchStocks.length === 0 && (
                      <p className="text-xs text-neutral-400">No hay sedes activas registradas</p>
                    )}
                  </div>
                </div>
              </>
            ))}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving || (isPurchaseMode ? !canSubmitPurchase : loadingStock || !canSubmitStockTopUp)}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : isPurchaseMode ? "Registrar compra" : "Agregar stock"}
            </button>
          </div>
        </div>
      </div>

      {creatingProductFor && (
        <ProductModal
          onClose={() => setCreatingProductFor(null)}
          onSaved={(newProduct) => {
            // Se agrega al catálogo ya cargado (sin recargar la lista
            // completa) y queda seleccionado en la fila que abrió el modal,
            // para que el admin pueda seguir con la compra que estaba
            // registrando.
            setProducts((prev) => [...prev, newProduct]);
            updateItem(creatingProductFor.branchIndex, creatingProductFor.itemIndex, {
              productId: newProduct._id,
            });
            setCreatingProductFor(null);
          }}
        />
      )}

      {creatingBranchFor !== null && (
        <BranchModal
          onClose={() => setCreatingBranchFor(null)}
          onSaved={(newBranch) => {
            // Mismo patrón que la creación de producto en línea: se agrega
            // al catálogo de sedes ya cargado y queda seleccionada en la
            // fila que abrió el modal, sin recargar la lista completa.
            setBranches((prev) => [...prev, newBranch]);
            updateBranchEntry(creatingBranchFor, newBranch._id);
            setCreatingBranchFor(null);
          }}
        />
      )}
    </div>
  );
}
