import { useEffect, useState } from "react";
import { adminApi } from "../services/api";
import { Plus, Trash2 } from "lucide-react";
import SaleReceipt, { money, paymentMethodLabels } from "./SaleReceipt";

interface SaleModalProps {
  initialBranchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface SaleRow {
  productId: string;
  quantity: string;
}

export default function SaleModal({ initialBranchId, onClose, onSaved }: SaleModalProps) {
  const [me, setMe] = useState<{ name: string; role: string; branchId?: string } | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState(initialBranchId || "");

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [rows, setRows] = useState<SaleRow[]>([{ productId: "", quantity: "1" }]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [category, setCategory] = useState<"REGULAR" | "SPECIAL">("REGULAR");
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdSale, setCreatedSale] = useState<any>(null);

  // Un GERENTE solo puede vender a nombre de su propia sede — el backend ya
  // lo fuerza sin importar qué mande el body, esto es solo para que el
  // selector coincida con esa realidad en vez de sugerir una opción inválida.
  const isManager = me?.role === "MANAGER";

  useEffect(() => {
    Promise.all([adminApi.me(), adminApi.listBranches({ pageSize: 100 })]).then(
      ([meRes, branchesRes]) => {
        setMe(meRes);
        setBranches(branchesRes.data);
        if (meRes.role === "MANAGER" && meRes.branchId) {
          setSelectedBranchId(String(meRes.branchId));
        }
      }
    );
  }, []);

  useEffect(() => {
    if (!selectedBranchId) {
      setProducts([]);
      return;
    }
    setLoadingProducts(true);
    setRows([{ productId: "", quantity: "1" }]);
    adminApi
      .listProducts({ branchId: selectedBranchId, pageSize: 100 })
      .then((res) => setProducts(res.data.filter((p: any) => p.branchStock > 0)))
      .catch((err: any) => setError(err.message || "No se pudo cargar el catálogo"))
      .finally(() => setLoadingProducts(false));
  }, [selectedBranchId]);

  const selectedBranch = branches.find((b) => b._id === selectedBranchId);

  const productById = (id: string) => products.find((p) => p._id === id);

  const updateRow = (index: number, patch: Partial<SaleRow>) => {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows([...rows, { productId: "", quantity: "1" }]);
  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index));

  const lineItems = rows
    .filter((r) => r.productId && Number(r.quantity) > 0)
    .map((r) => {
      const product = productById(r.productId);
      const quantity = Number(r.quantity);
      const price = product?.price || 0;
      return { productId: r.productId, name: product?.name || "", quantity, price, total: price * quantity };
    });

  const total = lineItems.reduce((sum, it) => sum + it.total, 0);
  

  const hasOverStock = rows.some((r) => {
    const product = productById(r.productId);
    return product && Number(r.quantity) > product.branchStock;
  });

  const submit = async () => {
    if (!selectedBranchId) {
      setError("Selecciona la sede donde se realizó la venta");
      return;
    }
    if (lineItems.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }
    if (hasOverStock) {
      setError("Alguno de los productos supera el stock disponible en la sede");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const customer =
        customerName || customerDocument || customerEmail
          ? { name: customerName || undefined, document: customerDocument || undefined, email: customerEmail || undefined }
          : undefined;

      const sale = await adminApi.createSale({
        branchId: selectedBranchId,
        items: lineItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        paymentMethod,
        customer,
      });

      setCreatedSale(sale);
      onSaved();
    } catch (err: any) {
      const message = err.message || "No se pudo registrar la venta";
      setError(message);
      if (message.toLowerCase().includes("tope de consumidor final")) {
        setShowCustomer(true);
      }
    } finally {
      setSaving(false);
    }
  };

  if (createdSale) {
    return <SaleReceipt sale={createdSale} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Agregar venta</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-xs text-neutral-500">Sede</label>
            {isManager ? (
              <p className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1 bg-neutral-50 text-neutral-600">
                {selectedBranch?.name || "Tu sede"}
              </p>
            ) : (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="">Selecciona una sede</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedBranchId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-500">Productos</label>
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                >
                  <Plus size={14} />
                  Agregar producto
                </button>
              </div>

              {loadingProducts ? (
                <p className="text-sm text-neutral-400">Cargando catálogo...</p>
              ) : products.length === 0 ? (
                <p className="text-sm text-neutral-400">Esta sede no tiene productos con stock disponible</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((row, i) => {
                    const product = productById(row.productId);
                    const overStock = product && Number(row.quantity) > product.branchStock;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-1">
                          <select
                            value={row.productId}
                            onChange={(e) => updateRow(i, { productId: e.target.value })}
                            className="w-full border border-neutral-200 rounded-lg p-2 text-sm"
                          >
                            <option value="">Selecciona un producto</option>
                            {products.map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name} (disponible: {p.branchStock})
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateRow(i, { quantity: e.target.value })}
                          className={`w-20 border rounded-lg p-2 text-sm ${
                            overStock ? "border-red-300 text-red-600" : "border-neutral-200"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          disabled={rows.length === 1}
                          className="text-neutral-400 hover:text-red-500 disabled:opacity-30 p-2"
                          aria-label="Quitar producto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="text-xs text-neutral-500">Método de pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                >
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            {/** 
              <div>
                <label className="text-xs text-neutral-500">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "REGULAR" | "SPECIAL")}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                >
                  <option value="REGULAR">Regular</option>
                  <option value="SPECIAL">Especial</option>
                </select>
              </div>

              */}

              <div>
                <button
                  type="button"
                  onClick={() => setShowCustomer((v) => !v)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  {showCustomer ? "Ocultar datos del cliente" : "+ Datos del cliente (opcional)"}
                </button>
                {showCustomer && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nombre"
                      className="border border-neutral-200 rounded-lg p-2 text-sm"
                    />
                    <input
                      value={customerDocument}
                      onChange={(e) => setCustomerDocument(e.target.value)}
                      placeholder="Documento"
                      className="border border-neutral-200 rounded-lg p-2 text-sm"
                    />
                    <input
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Correo"
                      className="border border-neutral-200 rounded-lg p-2 text-sm col-span-2"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm bg-neutral-50 rounded-lg p-3">
                {/** 
                <div className="flex justify-between text-neutral-500">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Impuesto (INC)</span>
                  <span>{money(tax)}</span>
                </div>
                */}
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </div>
            </div>
          )}

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
              disabled={saving || !selectedBranchId || lineItems.length === 0 || hasOverStock}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Registrando..." : "Registrar venta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
