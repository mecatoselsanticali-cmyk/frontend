import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import StockModal from "../components/StockModal";
import PurchaseEditModal from "../components/PurchaseEditModal";
import MoreFiltersModal from "../components/MoreFiltersModal";
import ActionsMenu from "../components/ActionsMenu";
import { formatDateTime } from "../utils/timezone";

/**
 * Vista consolidada de compras: las que los cajeros registran desde la
 * pestaña "Compras" del POS (ver cajero/pages/Compras.tsx, solo lectura
 * aquí) y las que el admin registra directamente con "+ Nueva compra"
 * (StockModal en modo compra) — esta última además incrementa el stock del
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
  // Modal "Más filtros" de la vista de celular (ver punto 63 de CLAUDE.md)
  // — esta página no tiene buscador de texto, así que en celular no queda
  // NINGÚN filtro visible fuera del modal, solo el botón que lo abre.
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [date, setDate] = useState("");
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
        from: date || undefined,
        to: date || undefined,
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

  useEffect(load, [selectedBranch, date, productId, registeredBy, page, isMobile]);

  // Cambiar de sede o cualquier filtro debe volver a la página 1 — si no,
  // se podría quedar en una página que ya no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [selectedBranch, date, productId, registeredBy]);

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

  const extraFiltersCount = [date, productId, registeredBy].filter(Boolean).length;

  // "Limpiar filtros" del modal "Más filtros" (ver punto 63 de CLAUDE.md)
  // — resetea los tres filtros de esta página a su valor por defecto.
  const clearFilters = () => {
    setDate("");
    setProductId("");
    setRegisteredBy("");
  };

  return (
    <div className="space-y-4">
      {!isMobile && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-neutral-500 text-sm">Compras</h3>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Producto: todos</option>
              {productOptions.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={registeredBy}
              onChange={(e) => setRegisteredBy(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Usuario: todos</option>
              {userOptions.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-start gap-3 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <div className="text-sm text-neutral-500">
              Total: <span className="font-bold text-neutral-800">${totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full sm:w-auto shrink-0"
            >
              + Nueva compra
            </button>
          </div>
        </div>
      )}

      {/* Vista de celular (ver punto 63 de CLAUDE.md) — esta página no
          tiene buscador de texto, así que acá no queda ningún filtro
          visible, solo el botón que abre el modal con los tres. */}
      {isMobile && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-neutral-500">
              Total: <span className="font-bold text-neutral-800">${totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <button
              onClick={() => setFiltersModalOpen(true)}
              className="relative shrink-0 px-3 py-2 rounded-lg text-sm font-medium border bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            >
              Filtros
              {extraFiltersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {extraFiltersCount}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full"
          >
            + Nueva compra
          </button>
        </div>
      )}

      {filtersModalOpen && (
        <MoreFiltersModal onClose={() => setFiltersModalOpen(false)} onClear={clearFilters}>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Producto</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todos</option>
              {productOptions.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Usuario</label>
            <select
              value={registeredBy}
              onChange={(e) => setRegisteredBy(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todos</option>
              {userOptions.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </MoreFiltersModal>
      )}

      <DataTable
        loading={loading}
        rows={purchases}
        emptyMessage="No hay compras registradas todavía"
        columns={[
          {
            key: "createdAt",
            label: "Fecha",
            render: (r) => formatDateTime(r.createdAt),
          },
          { key: "supplierName", label: "Proveedor / lugar" },
          {
            key: "amount",
            label: "Monto",
            render: (r) => `$${r.amount.toLocaleString("es-CO")}`,
          },
          { key: "concept", label: "Concepto", hideOnMobile: true },
          {
            key: "productId",
            label: "Producto",
            render: (r) =>
              r.productId ? `${r.productId.name}${r.quantity ? ` × ${r.quantity}` : ""}` : "—",
          },
          {
            key: "branchId",
            label: "Sede",
            render: (r) => r.branchId?.name || "—",
          },
          {
            key: "registeredBy",
            label: "Registrado por",
            hideOnMobile: true,
            render: (r) => r.registeredBy?.name || "—",
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
                  className="text-brand-600 hover:underline"
                >
                  Ver foto
                </a>
              ) : (
                "—"
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

      {modalOpen && <StockModal onClose={() => setModalOpen(false)} onSaved={load} />}

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
