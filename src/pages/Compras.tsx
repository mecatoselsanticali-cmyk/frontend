import ComprasFiltersMobile from "../components/ComprasFiltersMobile";
import KpiCarousel from "../components/KpiCarousel";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import PurchaseModal from "../components/PurchaseModal";
import PurchaseEditModal from "../components/PurchaseEditModal";
import { Calendar, Package, User, Plus, FileText, ShoppingCart, type LucideIcon } from "lucide-react";
import ActionsMenu from "../components/ActionsMenu";
import { formatDate, formatTime } from "../utils/timezone";

const titleCase = (value?: string) => value?.trim().toLocaleLowerCase("es-CO").replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-CO")) || "—";
const money = (value: number) => value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function FilterSelect({ label, icon: Icon, value, onChange, options }: {
  label: string; icon: LucideIcon; value: string; onChange: (value: string) => void;
  options: { _id: string; name: string }[];
}) {
  return <label className="flex min-w-0 flex-1 basis-44 items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-zinc-400">
    <Icon size={17} className="shrink-0" aria-hidden="true" />
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full bg-white text-sm text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
      <option value="">{label}: todos</option>
      {options.map((option) => <option key={option._id} value={option._id}>{titleCase(option.name)}</option>)}
    </select>
  </label>;
}

function PurchaseDate({ value }: { value: string }) {
  return <div className="whitespace-nowrap"><p className="font-medium text-zinc-700">{formatDate(value, { day: "2-digit", month: "short", year: "numeric" })}</p><p className="mt-1 text-xs text-zinc-400">{formatTime(value, { hour: "2-digit", minute: "2-digit", hour12: true })}</p></div>;
}

function RegisteredUser({ name }: { name?: string }) {
  const initials = name?.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
  return <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[10px] font-semibold text-orange-700" aria-hidden="true">{initials || <User size={14} />}</span><span className="text-zinc-600">{titleCase(name)}</span></div>;
}

/**
 * Vista consolidada de compras: las que los cajeros registran desde la
 * pestaña "Compras" del POS (ver cajero/pages/Compras.tsx, solo lectura
 * aquí) y las que el admin registra directamente con "+ Nueva compra"
 * (PurchaseModal en modo compra) — esta última además incrementa el stock del
 * producto en las sedes elegidas, por eso trae producto/cantidad.
 */

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

export default function Compras() {
  const isMobile = useIsMobile();
  const [selectedBranch] = useSelectedBranch();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [productId, setProductId] = useState("");
  const [registeredBy, setRegisteredBy] = useState("");
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [userOptions, setUserOptions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = isMobile ? 5 : 20;

  const load = () => {
    setLoading(true);
    adminApi
      .listPurchases({
        branchId: selectedBranch || undefined,
        from: from || undefined,
        to: to || undefined,
        productId: productId || undefined,
        registeredBy: registeredBy || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setPurchases(res.data);
        setTotal(res.total);
        setTotalAmount(res.totalAmount);
        setTotalPages(res.totalPages);
        // Si una eliminación (o algún filtro) dejó la página actual vacía,
        // retrocede a la última página real.
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch, from, to, productId, registeredBy, page, isMobile]);

  // Cambiar de sede o cualquier filtro debe volver a la página 1 — si no,
  // se podría quedar en una página que ya no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [selectedBranch, from, to, productId, registeredBy]);

  // Opciones de los filtros "Producto"/"Usuario" — solo productos/usuarios
  // que efectivamente tienen al menos una compra registrada en la sede
  // vigente (ver listPurchaseProducts/listPurchaseUsers en el backend),
  // mismo criterio que el filtro "Usuario" de Ventas.tsx. Se recargan al
  // cambiar de sede.
  useEffect(() => {
    adminApi
      .listPurchaseProducts(selectedBranch || undefined)
      .then(setProductOptions)
      .catch(() => setProductOptions([]));
    adminApi
      .listPurchaseUsers(selectedBranch || undefined)
      .then(setUserOptions)
      .catch(() => setUserOptions([]));
  }, [selectedBranch]);

  const handleDelete = async (purchase: any) => {
    const result = await Swal.fire({
      title: "¿Eliminar esta compra?",
      text: purchase.productId
        ? "Se revertirá el stock que había agregado, si sigue disponible en la sede."
        : "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    try {
      await adminApi.deletePurchase(purchase._id);
      load();
      Swal.fire({ title: "Compra eliminada", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "No se pudo eliminar", text: err.message || "Intenta de nuevo", icon: "error" });
    }
  };

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setProductId("");
    setRegisteredBy("");
  };

  return (
    <div className="space-y-4">
      <KpiCarousel label="Métricas de compras" desktopColumns={1}>
        <section aria-label="Resumen de compras" aria-busy={loading} className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xs font-medium text-zinc-500">Total Compras del periodo</h2><p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-zinc-900">{loading ? "…" : money(totalAmount)}</p><p className="mt-2 text-xs text-zinc-500">{loading ? "Cargando registros…" : `${total} ${total === 1 ? "transacción" : "transacciones"}`} · {from || to ? "Periodo seleccionado" : "Todo el historial"}</p></div>
            <span className="rounded-xl bg-orange-50 p-3 text-orange-600"><ShoppingCart size={22} aria-hidden="true" /></span>
          </div>
        </section>
      </KpiCarousel>
      {isMobile ? (
        <ComprasFiltersMobile from={from} to={to} productId={productId} registeredBy={registeredBy} products={productOptions.map((product) => ({ ...product, name: titleCase(product.name) }))} users={userOptions.map((user) => ({ ...user, name: titleCase(user.name) }))} onRangeChange={(range) => { setFrom(range.from); setTo(range.to); }} onProductChange={setProductId} onUserChange={setRegisteredBy} onCreate={() => setModalOpen(true)} onClear={clearFilters} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <fieldset className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2">
              <legend className="sr-only">Rango de fechas</legend><Calendar size={17} className="text-zinc-400" aria-hidden="true" />
              <input type="date" aria-label="Desde" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="min-w-0 rounded bg-white py-0.5 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <span className="text-xs text-zinc-400">a</span>
              <input type="date" aria-label="Hasta" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="min-w-0 rounded bg-white py-0.5 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </fieldset>
            <FilterSelect label="Producto" icon={Package} value={productId} onChange={setProductId} options={productOptions} />
            <FilterSelect label="Usuario" icon={User} value={registeredBy} onChange={setRegisteredBy} options={userOptions} />
            {(from || to || productId || registeredBy) && <button type="button" onClick={clearFilters} className="rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-orange-600">Limpiar filtros</button>}
          </div>
          <button type="button" onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"><Plus size={17} aria-hidden="true" />Nueva compra</button>
        </div>
      )}

      <DataTable
        loading={loading}
        rows={purchases}
        emptyMessage="No hay compras registradas todavía"
        columns={[
          {
            key: "createdAt",
            label: "Fecha",
            render: (r) => <PurchaseDate value={r.createdAt} />,
          },
          { key: "supplierName", label: "Proveedor / lugar", render: (r) => <span className="font-medium text-zinc-700">{titleCase(r.supplierName)}</span> },
          {
            key: "amount",
            label: "Monto",
            align: "right",
            render: (r) => <span className="whitespace-nowrap font-semibold text-zinc-900">{money(r.amount)}</span>,
          },
          { key: "concept", label: "Concepto", hideOnMobile: true, render: (r) => titleCase(r.concept) },
          {
            key: "productId",
            label: "Producto",
            render: (r) =>
              r.productId ? `${titleCase(r.productId.name)}${r.quantity ? ` × ${r.quantity}` : ""}` : "—",
          },
          {
            key: "branchId",
            label: "Sede",
            render: (r) => <span title={r.branchId?.name} className="inline-flex whitespace-nowrap rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{r.branchId?.name ? titleCase(r.branchId.name.replace(/^Mecatos\s+el\s+Santi\s*[-–—:]?\s*/i, "").replace(/^Sede\s+/i, "") || r.branchId.name) : "—"}</span>,
          },
          {
            key: "registeredBy",
            label: "Registrado por",
            hideOnMobile: true,
            render: (r) => <RegisteredUser name={r.registeredBy?.name} />,
          },
          {
            key: "receiptImageUrl",
            label: "Recibo",
            hideOnMobile: true,
            render: (r) =>
              r.receiptImageUrl ? (
                <a
                  href={r.receiptImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                >
                  <FileText size={14} aria-hidden="true" />
                  {/\.pdf(?:[?#]|$)/i.test(r.receiptImageUrl) ? "Ver PDF" : "Ver adjunto"}
                </a>
              ) : (
                <span className="whitespace-nowrap text-xs text-zinc-400">Sin adjunto</span>
              ),
          },
          {
            key: "acciones",
            label: "Acciones",
            stickyRight: true,
            centerHeader: true,
            render: (r) => (
              <div className="flex justify-center">
                <ActionsMenu
                  items={[
                    { label: "Editar", onClick: () => setEditingPurchase(r) },
                    { label: "Eliminar", danger: true, onClick: () => handleDelete(r) },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} compra{total === 1 ? "" : "s"} · página {page} de {totalPages}
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

      {modalOpen && <PurchaseModal onClose={() => setModalOpen(false)} onSaved={load} />}

      {editingPurchase && (
        <PurchaseEditModal
          purchase={editingPurchase}
          onClose={() => setEditingPurchase(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
