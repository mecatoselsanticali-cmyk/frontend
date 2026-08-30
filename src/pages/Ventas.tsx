import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import SaleModal from "../components/SaleModal";
import SaleEditModal from "../components/SaleEditModal";
import SaleReceipt from "../components/SaleReceipt";
import ActionsMenu from "../components/ActionsMenu";
import { formatDateTime } from "../utils/timezone";

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  SENT: "bg-blue-50 text-blue-600",
  APPROVED: "bg-green-50 text-green-600",
  REJECTED: "bg-red-50 text-red-600",
};

// Etiquetas específicas de esta tabla — a propósito NO son las mismas que
// `paymentMethodLabels` de SaleReceipt.tsx (usadas en el recibo y en los
// modals de crear/editar venta): acá se pidió explícitamente "Datáfono" en
// vez de "Tarjeta" y "DIDI" en vez de "App de domicilios".
const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  NEQUI: "Nequi",
  CARD: "Datáfono",
  DELIVERY_APP: "DIDI",
};

// "" = pestaña "Todas" (sin filtrar por categoría) — categoría es una
// etiqueta manual elegida al crear/editar la venta, no calculada a partir
// del monto ni de otras ventas (ver punto 20 de CLAUDE.md).
const categoryTabs: { value: "" | "REGULAR" | "SPECIAL"; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "REGULAR", label: "Regular" },
  { value: "SPECIAL", label: "Especial" },
];

export default function Ventas() {
  const [selectedBranch] = useSelectedBranch();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dianStatus, setDianStatus] = useState("");
  const [category, setCategory] = useState<"" | "REGULAR" | "SPECIAL">("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [cashierOptions, setCashierOptions] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [viewingSale, setViewingSale] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 12;

  const load = () => {
    setLoading(true);
    adminApi
      .listSales({
        branchId: selectedBranch || undefined,
        dianStatus: dianStatus || undefined,
        category: category || undefined,
        paymentMethod: paymentMethod || undefined,
        cashierId: cashierId || undefined,
        search: search.trim() || undefined,
        from: date || undefined,
        to: date || undefined,
        page,
        pageSize,
      })
      .then((res) => {
        setSales(res.data);
        setTotal(res.total);
        setTotalAmount(res.totalAmount);
        setTotalPages(res.totalPages);
        // Si una cancelación u otro cambio de filtro dejó la página actual
        // vacía, retrocede a la última página real.
        if (res.page > res.totalPages) setPage(res.totalPages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch, dianStatus, category, paymentMethod, cashierId, search, date, page]);

  // Cambiar de sede/filtro/categoría debe volver a la página 1 — si no, se
  // podría quedar en una página que ya no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1);
  }, [selectedBranch, dianStatus, category, paymentMethod, cashierId, search, date]);

  // Opciones del filtro "Usuario" — solo quienes ya tienen al menos una
  // venta registrada en la sede vigente (ver listSaleUsers en el backend),
  // no todos los usuarios del sistema. Se recarga al cambiar de sede.
  useEffect(() => {
    adminApi
      .listSaleUsers(selectedBranch || undefined)
      .then(setCashierOptions)
      .catch(() => setCashierOptions([]));
  }, [selectedBranch]);

  const handleCancel = async (sale: any) => {
    const result = await Swal.fire({
      title: "¿Eliminar esta venta?",
      text: "La venta quedará cancelada (no se borra el registro). Si había descontado stock, se restaura.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    try {
      await adminApi.cancelSale(sale._id);
      load();
      Swal.fire({ title: "Venta cancelada", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo cancelar la venta", icon: "error" });
    }
  };

  // Ventas por DELIVERY_APP (Rappi/DiDi) nacen con paymentStatus
  // PENDING_PAYMENT — el agregador liquida el dinero a la cuenta bancaria
  // días después, no el mismo día como CASH/NEQUI/CARD (ver punto 34 de
  // CLAUDE.md). Esto lo confirma un admin/gerente a mano cuando ve el
  // depósito reflejado en el banco — no hay forma automática de saberlo.
  const handleConfirmPayment = async (sale: any) => {
    const result = await Swal.fire({
      title: "¿Confirmar pago recibido?",
      text: "Marca esta venta como liquidada (el dinero de la app de domicilios ya llegó a la cuenta bancaria).",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    try {
      await adminApi.confirmSalePayment(sale._id);
      load();
      Swal.fire({ title: "Pago confirmado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo confirmar el pago", icon: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex bg-neutral-100 rounded-lg p-1 gap-1">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategory(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              category === tab.value
                ? "bg-white text-neutral-800 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por CUFE o ID..."
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm w-56"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={cashierId}
            onChange={(e) => setCashierId(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Usuario: todos</option>
            {cashierOptions.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Método de pago: todos</option>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={dianStatus}
            onChange={(e) => setDianStatus(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Estado DIAN: todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="SENT">Enviado</option>
            <option value="APPROVED">Aprobado</option>
            <option value="REJECTED">Rechazado</option>
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
            + Agregar venta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-500 text-left">
              <tr>
                <th className="p-3 whitespace-nowrap">CUFE / ID</th>
                <th className="p-3 whitespace-nowrap">Fecha</th>
                {/* Total y Estado DIAN se adelantaron en el orden (van
                    justo después de las dos columnas que siempre quedan
                    visibles) para que sean lo primero que aparece con
                    scroll en celular — mismo criterio que "Monto" en
                    Compras.tsx, ver punto 36 de CLAUDE.md. */}
                <th className="p-3 whitespace-nowrap">Total</th>
                <th className="p-3 whitespace-nowrap">Estado DIAN</th>
                <th className="p-3 whitespace-nowrap">Usuario</th>
                <th className="p-3 whitespace-nowrap">Método de Pago</th>
                <th className="p-3 whitespace-nowrap hidden sm:table-cell">Categoría</th>
                <th className="p-3 whitespace-nowrap">Sede</th>
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
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-neutral-400">
                    No hay ventas para el filtro seleccionado
                  </td>
                </tr>
              )}
              {sales.map((s) => {
                const cancelled = s.status === "CANCELLED";
                return (
                  <tr key={s._id} className={`border-t border-neutral-50 ${cancelled ? "opacity-60" : ""}`}>
                    <td
                      className="p-3 text-xs text-neutral-500 font-mono truncate max-w-[140px]"
                      title={s.category === "SPECIAL" ? s.cufe || "" : String(s._id)}
                    >
                      {s.category === "SPECIAL" ? s.cufe || "—" : String(s._id).slice(-8).toUpperCase()}
                    </td>
                    <td className="p-3 text-neutral-500">
                      {formatDateTime(s.createdAt)}
                    </td>
                    <td className="p-3 font-medium">${s.total.toLocaleString("es-CO")}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusColors[s.dianStatus]}`}>
                        {s.dianStatus}
                      </span>
                      {cancelled && (
                        <span className="ml-1 text-xs px-2 py-1 rounded-full bg-red-50 text-red-600">
                          Cancelada
                        </span>
                      )}
                    </td>
                    <td className="p-3">{s.cashierId?.name || "—"}</td>
                    <td className="p-3">
                      {paymentMethodLabels[s.paymentMethod] || s.paymentMethod}
                      {s.paymentMethod === "DELIVERY_APP" && (
                        <span
                          className={`ml-2 text-xs px-2 py-1 rounded-full ${
                            s.paymentStatus === "PENDING_PAYMENT"
                              ? "bg-orange-50 text-orange-600"
                              : "bg-green-50 text-green-600"
                          }`}
                        >
                          {s.paymentStatus === "PENDING_PAYMENT" ? "Pago pendiente" : "Pagado"}
                        </span>
                      )}
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          s.category === "SPECIAL"
                            ? "bg-purple-50 text-purple-600"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {s.category === "SPECIAL" ? "Especial" : "Regular"}
                      </span>
                    </td>
                    <td className="p-3">{s.branchId?.name || "—"}</td>
                    <td className="p-3 sticky right-0 z-10 bg-white border-l border-neutral-200">
                      <div className="flex justify-center">
                        <ActionsMenu
                          items={[
                            ...(!cancelled
                              ? [{ label: "Editar", onClick: () => setEditingSale(s) }]
                              : []),
                            { label: "Ver recibo", onClick: () => setViewingSale(s) },
                            ...(!cancelled && s.paymentMethod === "DELIVERY_APP" && s.paymentStatus === "PENDING_PAYMENT"
                              ? [{ label: "Confirmar Pago", onClick: () => handleConfirmPayment(s) }]
                              : []),
                            ...(!cancelled
                              ? [{ label: "Eliminar", danger: true, onClick: () => handleCancel(s) }]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && total > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-neutral-500">
          <span>
            {total} venta{total === 1 ? "" : "s"} · página {page} de {totalPages}
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
        <SaleModal
          initialBranchId={selectedBranch || undefined}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
      )}

      {editingSale && (
        <SaleEditModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={load}
        />
      )}

      {viewingSale && (
        <SaleReceipt sale={viewingSale} onClose={() => setViewingSale(null)} />
      )}
    </div>
  );
}
