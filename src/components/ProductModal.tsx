import { useRef, useState } from "react";
import { adminApi } from "../services/api";
import { Hamburger } from "lucide-react";

interface Modifier {
  name: string;
  extraPrice: number;
}

interface ProductModalProps {
  product?: any; // si viene, el modal edita en vez de crear
  onClose: () => void;
  // Recibe el producto creado/editado — StockModal.tsx lo usa para agregar
  // el producto recién creado a su propio catálogo en memoria y
  // seleccionarlo, sin tener que recargar la lista completa.
  onSaved: (product?: any) => void;
}

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  price: "",
  taxType: "INC" as "INC" | "IVA" | "EXENTO",
  taxRate: "0.08",
};

const ProductCategoryOptions = [
  { value: "FRITANGA", label: "Fritanga" },
  { value: "ALMUERZOS", label: "Almuerzos" },
  { value: "BEBIDAS", label: "Bebidas" },
  { value: "OTRO", label: "Otro" },
];

export default function ProductModal({ product, onClose, onSaved }: ProductModalProps) {
  const isEditing = Boolean(product);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(
    product
      ? {
          name: product.name,
          sku: product.sku,
          category: product.category,
          price: String(product.price),
          taxType: product.taxType,
          taxRate: String(product.taxRate),
        }
      : emptyForm
  );
  const [modifiers, setModifiers] = useState<Modifier[]>(product?.modifiers || []);
  const [imageUrl, setImageUrl] = useState<string>(product?.imageUrl || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadingImage(true);
    try {
      // Esta es la MISMA foto (misma URL) que el POS mostrará en el grid de
      // productos del cajero — no hay una copia separada por pantalla.
      const { imageUrl: uploadedUrl } = await adminApi.uploadProductImage(file);
      setImageUrl(uploadedUrl);
    } catch (err: any) {
      setError(err.message || "No se pudo subir la imagen");
    } finally {
      setUploadingImage(false);
    }
  };

  const addModifier = () => setModifiers([...modifiers, { name: "", extraPrice: 0 }]);

  const updateModifier = (index: number, field: keyof Modifier, value: string) => {
    const next = [...modifiers];
    next[index] = {
      ...next[index],
      [field]: field === "extraPrice" ? Number(value) : value,
    };
    setModifiers(next);
  };

  const removeModifier = (index: number) => setModifiers(modifiers.filter((_, i) => i !== index));

  const submit = async () => {
    if (!form.name || !form.category || !form.price) {
      setError("Nombre, categoría y precio son obligatorios");
      return;
    }
    if (uploadingImage) {
      setError("Espera a que termine de subirse la imagen");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      // El SKU no se manda al crear: el backend lo genera (3 letras del
      // nombre + secuencia) para garantizar que no choque con otro producto.
      ...(isEditing ? { sku: form.sku } : {}),
      category: form.category,
      price: Number(form.price),
      imageUrl: imageUrl || undefined,
      modifiers: modifiers.filter((m) => m.name.trim() !== ""),
    };

    try {
      const saved = isEditing
        ? await adminApi.updateProduct(product._id, payload)
        : await adminApi.createProduct(payload);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-[350px] max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">
              {isEditing ? "Editar producto" : "Nuevo producto"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Foto del producto */}
          <div>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl bg-neutral-100 overflow-hidden flex items-center justify-center border border-neutral-200 shrink-0">
                {uploadingImage ? (
                  <span className="text-xs text-neutral-400">Subiendo...</span>
                ) : imageUrl ? (
                  <img src={imageUrl} alt="Producto" className="w-full h-full object-cover" />
                ) : (
                  <Hamburger className="text-neutral-400" size={40} />
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="bg-neutral-100 hover:bg-neutral-200 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {imageUrl ? "Cambiar foto" : "Subir foto"}
                </button>
                <p className="text-xs text-neutral-400 mt-1">JPG, PNG o WebP. Máx. 5MB.</p>
              </div>
            </div>
          </div>

          {/* Datos básicos */}
          <div className="w-auto">
            <div className="col-span-2">
              <label className="text-xs text-neutral-500">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="Ej. Empanada de carne"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="">Selecciona una categoría</option>
                {ProductCategoryOptions.map((pco) => (
                  <option key={pco.value} value={pco.value}>
                    {pco.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-neutral-500">Precio</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            {/**
             * 
            <div>
              <label className="text-xs text-neutral-500">Tipo de impuesto</label>
              <select
                value={form.taxType}
                onChange={(e) => setForm({ ...form, taxType: e.target.value as any })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="INC">INC (8%)</option>
                <option value="IVA">IVA (19%)</option>
                <option value="EXENTO">Exento</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-neutral-500">Tasa de impuesto (decimal, ej. 0.08)</label>
              <input
                type="number"
                step="0.01"
                value={form.taxRate}
                onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            */}
          </div>

          {/* Modificadores 
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-neutral-500">
                Modificadores (ej. "Sin azúcar", "Extra queso")
              </label>
              <button
                type="button"
                onClick={addModifier}
                className="text-xs text-brand-600 hover:underline"
              >
                + Agregar
              </button>
            </div>
            {modifiers.length === 0 && (
              <p className="text-xs text-neutral-400">Sin modificadores configurados</p>
            )}
            <div className="space-y-2">
              {modifiers.map((mod, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={mod.name}
                    onChange={(e) => updateModifier(i, "name", e.target.value)}
                    placeholder="Nombre del modificador"
                    className="flex-1 border border-neutral-200 rounded-lg p-2 text-sm"
                  />
                  <input
                    type="number"
                    value={mod.extraPrice}
                    onChange={(e) => updateModifier(i, "extraPrice", e.target.value)}
                    placeholder="Precio extra"
                    className="w-28 border border-neutral-200 rounded-lg p-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeModifier(i)}
                    className="text-red-400 hover:text-red-600 px-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          */}

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
              disabled={saving || uploadingImage}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
