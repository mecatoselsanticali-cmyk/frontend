import KpiCarousel from "../components/KpiCarousel";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import SaleModal from "../components/SaleModal";
import SaleEditModal from "../components/SaleEditModal";
import SaleReceipt from "../components/SaleReceipt";
import ActionsMenu from "../components/ActionsMenu";
import LogoLoader from "../components/LogoLoader";
import PendingDidiPaymentsModal from "../components/PendingDidiPaymentsModal";
import MoreFiltersModal from "../components/MoreFiltersModal";
import { Search, Calendar, Plus, ShoppingBag, BadgeCheck, Wallet, Copy, Check, type LucideIcon } from "lucide-react";
import { formatDate, formatTime, formatDateTime, todayColombia, dayOfWeekForDateString } from "../utils/timezone";

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200/60",
  SENT: "bg-blue-50 text-blue-700 border-blue-200/60",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  REJECTED: "bg-red-50 text-red-700 border-red-200/60",
  // Estado terminal de una venta category: "REGULAR" — nunca hubo (ni
  // habrá) intento de emisión, así que no es ni un error (rojo) ni algo en
  // curso (ámbar) — gris neutro, ver punto 37 de backend/CLAUDE.md.
  NOT_EMITTED: "bg-zinc-100 text-zinc-600 border-zinc-200/60",
};

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;

function SalesKpi({ label, value, detail, icon: Icon, loading }: {
  label: string; value: string; detail: string; icon: LucideIcon; loading: boolean;
}) {
  return <section aria-busy={loading} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-xs font-medium text-zinc-500">{label}</h2><Icon size={19} className="text-orange-500" aria-hidden="true" /></div>
    <p className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900">{loading ? "…" : value}</p>
    <p className="mt-2 text-xs leading-5 text-zinc-500">{loading ? "Calculando…" : detail}</p>
  </section>;
}

function CopySaleId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); }
    catch { Swal.fire({ title: "No se pudo copiar", text: value, icon: "info" }); }
  };
  return <button type="button" onClick={copy} title={value} aria-label={`Copiar CUFE o ID: ${value}`} className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><span>{value.length > 10 ? `${value.slice(0, 10)}…` : value}</span>{copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}<span className="sr-only" role="status">{copied ? "Copiado" : ""}</span></button>;
}

function downloadTicket(sale: any) {
  const lines = ["Mecatos el Santi — Ticket de venta", `ID: ${sale._id}`, `Fecha: ${formatDateTime(sale.createdAt)}`, `Sede: ${sale.branchId?.name || "—"}`, `Usuario: ${sale.cashierId?.name || "—"}`, "", ...(sale.items || []).map((item: any) => `${item.quantity} × ${item.name} — ${money(item.subtotal ?? item.price * item.quantity)}`), "", `Total: ${money(sale.total)}`, `Estado: ${sale.status || "—"}`, "Este ticket no sustituye la factura electrónica."];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ticket-${sale._id}.txt`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Etiqueta en español para la columna "Estado DIAN" — antes mostraba el
// valor crudo del enum (`s.dianStatus`, en inglés) directo en la tabla,
// visible para el cliente. El fallback `|| s.dianStatus` cubre cualquier
// valor futuro del enum que todavía no tenga traducción acá, para no dejar
// la celda vacía.
const dianStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  SENT: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  NOT_EMITTED: "No emitida",
};

// Etiquetas específicas de esta tabla — a propósito NO son las mismas que
// `paymentMethodLabels` de SaleReceipt.tsx (usadas en el recibo y en los
// modals de crear/editar venta): acá se pidió explícitamente "DIDI" en vez
// de "App de domicilios". Incluye los valores históricos (CASH/
// DELIVERY_APP) para que una venta vieja siga mostrando una etiqueta
// bonita en la columna — "CARD" (Datáfono, ver punto 61 de CLAUDE.md)
// sigue sin etiqueta acá a propósito, se ve con el valor crudo vía el
// fallback `|| s.paymentMethod` más abajo. Ver punto 34 de
// backend/CLAUDE.md para el detalle del refactor método-de-pago vs. canal.
const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  DELIVERY_APP: "DIDI",
  BANCOLOMBIA: "Bancolombia",
};

// Opciones de FILTRO — solo los valores activos/nuevos. El backend agrupa
// por PAYMENT_METHOD_GROUP (ver adminController.listSales), así que
// filtrar por "Efectivo" también trae ventas viejas guardadas como CASH
// sin necesitar exponerlas como opción aparte acá.
const paymentMethodFilterOptions: Record<string, string> = {
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  BANCOLOMBIA: "Bancolombia",
};

// "" = pestaña "Todas" (sin filtrar por categoría) — categoría es una
// etiqueta manual elegida al crear/editar la venta, no calculada a partir
// del monto ni de otras ventas (ver punto 20 de CLAUDE.md).
const categoryTabs: { value: "" | "REGULAR" | "SPECIAL"; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "REGULAR", label: "Regular" },
  { value: "SPECIAL", label: "Especial" },
];

// Misma "propia copia chica" que `useIsMobile()` en Dashboard.tsx/
// Topbar.tsx/CashierLayout.tsx — no hay un hook compartido para esto en
// el proyecto (ver punto 36 de CLAUDE.md). Acá decide el `pageSize` de la
// paginación: 5 filas por página en celular en vez de las 12 de
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

export default function Ventas() {
  const isMobile = useIsMobile();
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
  // Modal de "pendientes DiDi/Rappi" (ver punto 53 de CLAUDE.md) — abre
  // desde el botón del mismo nombre, desde "Ver pendientes" del banner de
  // miércoles, o automáticamente ese mismo día (ver el `useEffect` de más
  // abajo). Reemplazó al diseño anterior de checkboxes sueltos en esta
  // tabla + un filtro que la forzaba a solo DELIVERY_APP pendientes —
  // pedido explícito de sacar eso de acá, se veía recargado.
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  // Modal "Más filtros" de la vista de celular (ver punto 63 de CLAUDE.md)
  // — solo `search` queda visible fuera del modal; todo lo demás (fecha,
  // usuario, método de pago, estado DIAN, categoría) vive adentro.
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [summary, setSummary] = useState<{ approved: number; notEmitted: number; other: number; count: number; primary: string; primaryCount: number } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryRevision, setSummaryRevision] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // Cuenta GLOBAL de ventas DiDi/Rappi pendientes (para el banner de
  // miércoles) — independiente de `total`, que es el conteo de la tabla
  // bajo los filtros que el admin tenga elegidos en este momento. Se
  // refresca junto con `load()` (mismo `.finally`), así que cualquier
  // confirmación (individual o en bloque) la deja al día sin necesitar su
  // propio efecto aparte.
  const [pendingDidiCount, setPendingDidiCount] = useState(0);
  const pageSize = isMobile ? 4 : 12;

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

    // Conteo global para el banner de miércoles (ver `pendingDidiCount`
    // arriba) — solo depende de la sede, no de los demás filtros de la
    // tabla; `pageSize: 1` porque solo hace falta `res.total`, no las filas.
    adminApi
      .listSales({
        branchId: selectedBranch || undefined,
        paymentMethod: "DELIVERY_APP",
        paymentStatus: "PENDING_PAYMENT",
        page: 1,
        pageSize: 1,
      })
      .then((res) => setPendingDidiCount(res.total))
      .catch(() => setPendingDidiCount(0));
  };

  const refresh = () => { load(); setSummaryRevision((value) => value + 1); };

  useEffect(load, [selectedBranch, dianStatus, category, paymentMethod, cashierId, search, date, page, isMobile]);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummary(null);
    const collectSummary = async () => {
      let currentPage = 1;
      let lastPage = 1;
      let approved = 0, notEmitted = 0, count = 0;
      const methods: Record<string, number> = {};
      do {
        const result = await adminApi.listSales({ branchId: selectedBranch || undefined, dianStatus: dianStatus || undefined, category: category || undefined, paymentMethod: paymentMethod || undefined, cashierId: cashierId || undefined, search: search.trim() || undefined, from: date || undefined, to: date || undefined, page: currentPage, pageSize: 100 });
        for (const sale of result.data) {
          if (sale.status === "CANCELLED") continue;
          count += 1;
          if (sale.dianStatus === "APPROVED") approved += 1;
          if (sale.dianStatus === "NOT_EMITTED") notEmitted += 1;
          const method = paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod || "Sin método";
          methods[method] = (methods[method] || 0) + 1;
        }
        lastPage = result.totalPages;
        currentPage += 1;
      } while (currentPage <= lastPage && !cancelled);
      const primary = Object.entries(methods).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))[0];
      if (!cancelled) setSummary({ approved, notEmitted, other: count - approved - notEmitted, count, primary: primary?.[0] || "Sin ventas", primaryCount: primary?.[1] || 0 });
    };
    collectSummary().catch(() => { if (!cancelled) setSummary(null); }).finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedBranch, dianStatus, category, paymentMethod, cashierId, search, date, summaryRevision]);

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
      title: "¿Anular esta venta?",
      text: "La venta quedará cancelada (no se borra el registro). Si había descontado stock, se restaura.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#a3a3a3",
    });
    if (!result.isConfirmed) return;

    try {
      await adminApi.cancelSale(sale._id);
      refresh();
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
      refresh();
      Swal.fire({ title: "Pago confirmado", icon: "success", timer: 1500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ title: "Error", text: err.message || "No se pudo confirmar el pago", icon: "error" });
    }
  };

  // Banner de recordatorio los miércoles (liquidación DiDi/Rappi semanal,
  // ver punto 53 de CLAUDE.md) — `dayOfWeekForDateString(todayColombia())`
  // en vez de `new Date().getDay()` a secas, para no depender de la zona
  // horaria del navegador de quien esté viendo el panel (mismo principio
  // que el resto del proyecto, ver punto 33 de CLAUDE.md raíz). Solo se
  // muestra si además hay ventas DiDi/Rappi realmente pendientes — un
  // miércoles con la cola en $0 no necesita el recordatorio. La cuenta es
  // GLOBAL (ver `pendingDidiCount` más arriba), no la de `total` de la
  // tabla — si el admin está viendo otro filtro (otra categoría, otro
  // método de pago), la tabla en pantalla puede mostrar 0 aunque sí haya
  // ventas pendientes en otro filtro; el banner no debería depender de eso.
  const isWednesdayInBogota = dayOfWeekForDateString(todayColombia()) === 3;
  const showWednesdayBanner = isWednesdayInBogota && pendingDidiCount > 0;

  // Apertura AUTOMÁTICA del modal de pendientes los miércoles, una sola
  // vez por visita a esta página — no cada vez que `pendingDidiCount` se
  // refresca (ej. después de que el admin confirme algunas y cierre el
  // modal, no debería reabrirse solo por eso). El guard vive en un
  // `useRef`, no en `useState`, justamente para que cambiar su valor NO
  // dispare un re-render/re-ejecución del efecto.
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (autoPromptedRef.current) return;
    if (isWednesdayInBogota && pendingDidiCount > 0) {
      autoPromptedRef.current = true;
      setPendingModalOpen(true);
    }
  }, [isWednesdayInBogota, pendingDidiCount]);

  // Cuántos de los filtros que viven DENTRO del modal "Más filtros" (todos
  // menos `search`, ver más abajo) están activos — se muestra como badge
  // en el botón para que un admin en celular sepa que hay filtros
  // aplicados sin tener que abrir el modal a mirar.
  const extraFiltersCount = [date, cashierId, paymentMethod, dianStatus, category].filter(Boolean).length;

  // "Limpiar filtros" del modal "Más filtros" (ver punto 63 de CLAUDE.md)
  // — resetea TODOS los filtros de esta página a su valor por defecto,
  // incluido `search` (que vive fuera del modal, en la barra compacta de
  // celular) — "todos los filtros" es del punto de vista del admin, no
  // solo los que técnicamente están dentro del modal en este momento.
  const clearFilters = () => {
    setSearch("");
    setDate("");
    setCashierId("");
    setPaymentMethod("");
    setDianStatus("");
    setCategory("");
  };

  return (
    <div className="space-y-4">
      <KpiCarousel label="Métricas de ventas">
        <SalesKpi label="Total Vendido" value={money(totalAmount)} detail={`${total} ${total === 1 ? "venta" : "ventas"} · ${date || "Todo el historial"}`} icon={ShoppingBag} loading={loading} />
        <SalesKpi label="Estado DIAN" value={summary ? `${summary.count ? (summary.approved / summary.count * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 }) : 0}% aprobadas` : "—"} detail={summary ? `${summary.approved} aprobadas · ${summary.notEmitted} no emitidas · ${summary.other} pendientes, enviadas o rechazadas` : "No se pudo cargar el desglose"} icon={BadgeCheck} loading={summaryLoading} />
        <SalesKpi label="Canal Principal" value={summary?.primary || "—"} detail={summary ? `${summary.primaryCount} de ${summary.count} ventas · Método de pago predominante` : "No se pudo cargar el desglose"} icon={Wallet} loading={summaryLoading} />
      </KpiCarousel>
      <p className="text-xs text-zinc-400">Métricas según los filtros seleccionados; el desglose DIAN y de pagos excluye ventas canceladas.</p>
      {showWednesdayBanner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-center justify-between gap-3 text-sm">
          <span>
            <strong>Es miércoles de liquidación DiDi.</strong> Revisa tu extracto bancario y confirma el
            depósito — hay {pendingDidiCount} venta{pendingDidiCount === 1 ? "" : "s"} pendiente
            {pendingDidiCount === 1 ? "" : "s"}.
          </span>
          {!pendingModalOpen && (
            <button
              onClick={() => setPendingModalOpen(true)}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              Ver pendientes
            </button>
          )}
        </div>
      )}

      {!isMobile && (
        <>
          <div className="inline-flex bg-zinc-100 rounded-xl p-1 gap-1 text-sm font-medium">
            {categoryTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setCategory(tab.value)}
                aria-pressed={category === tab.value}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === tab.value
                    ? "bg-white text-neutral-800 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" /><input aria-label="Buscar por CUFE o ID" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por CUFE o ID…" className="w-56 rounded-xl border border-zinc-200 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></div>
              <div className="relative"><Calendar size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" /><input type="date" aria-label="Fecha de ventas" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-zinc-200 py-2 pl-10 pr-3 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20" /></div>
              <select
                aria-label="Usuario"
                value={cashierId}
                onChange={(e) => setCashierId(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">Usuario: todos</option>
                {cashierOptions.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Método de pago"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">Método de pago: todos</option>
                {Object.entries(paymentMethodFilterOptions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {/* Abre el modal dedicado de pendientes DiDi/Rappi (ver punto 53
                  de CLAUDE.md) — ya no es un filtro que reescribe esta tabla,
                  es una acción que abre `PendingDidiPaymentsModal` con su
                  propia lista/selección/confirmación. */}
              <button
                onClick={() => setPendingModalOpen(true)}
                className="px-3 py-1.5 text-xs rounded-lg border bg-white border-zinc-200 text-zinc-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
              >
                Pendientes DiDi
              </button>
              <select
                aria-label="Estado DIAN"
                value={dianStatus}
                onChange={(e) => setDianStatus(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">Estado DIAN: todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="SENT">Enviada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="REJECTED">Rechazada</option>
                <option value="NOT_EMITTED">No emitida</option>
              </select>
            </div>
            <div className="flex flex-col items-start gap-3 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                <Plus size={16} aria-hidden="true" /> Agregar venta
              </button>
            </div>
          </div>
        </>
      )}

      {/* Vista de celular (ver punto 63 de CLAUDE.md) — solo el buscador
          queda visible junto al botón "Más filtros"; categoría, fecha,
          usuario, método de pago y estado DIAN viven en el modal. */}
      {isMobile && (
        <>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por CUFE o ID..."
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
          <div className="flex flex-col gap-2">
            <div className="text-sm text-neutral-500">
              Total: <span className="font-bold text-neutral-800">${totalAmount.toLocaleString("es-CO")}</span>
            </div>
            <button
              onClick={() => setPendingModalOpen(true)}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium border bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            >
              Pendientes DiDi/Rappi
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg w-full"
            >
              + Agregar venta
            </button>
          </div>
        </>
      )}

      {filtersModalOpen && (
        <MoreFiltersModal onClose={() => setFiltersModalOpen(false)} onClear={clearFilters}>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Categoría</label>
            <div className="inline-flex bg-zinc-100 rounded-xl p-1 gap-1 text-sm font-medium">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setCategory(tab.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    category === tab.value
                      ? "bg-white text-neutral-800 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
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
            <label className="text-xs text-neutral-500 mb-1 block">Usuario</label>
            <select
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todos</option>
              {cashierOptions.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Método de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todos</option>
              {Object.entries(paymentMethodFilterOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Estado DIAN</label>
            <select
              value={dianStatus}
              onChange={(e) => setDianStatus(e.target.value)}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-base"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="SENT">Enviada</option>
              <option value="APPROVED">Aprobada</option>
              <option value="REJECTED">Rechazada</option>
              <option value="NOT_EMITTED">No emitida</option>
            </select>
          </div>
        </MoreFiltersModal>
      )}

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
                <th className="p-3 whitespace-nowrap text-right">Total</th>
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
                  <td colSpan={9} className="p-10">
                    <div className="flex justify-center">
                      <LogoLoader size="sm" text="Cargando..." />
                    </div>
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
              {!loading && sales.map((s) => {
                const cancelled = s.status === "CANCELLED";
                // Cubre valores viejos (DELIVERY_APP) y nuevos
                // (BANCOLOMBIA), más el canal Rappi/DiDi directamente —
                // ver punto 34 de backend/CLAUDE.md. El canal ya implica
                // BANCOLOMBIA server-side, pero se chequea también acá por
                // si acaso una venta vieja tuviera paymentMethod
                // DELIVERY_APP con un orderType distinto.
                const isDeliveryAppSale =
                  s.paymentMethod === "DELIVERY_APP" ||
                  s.paymentMethod === "BANCOLOMBIA" ||
                  s.orderType === "DIDI" ||
                  s.orderType === "RAPPI";
                return (
                  <tr key={s._id} className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50/80 ${cancelled ? "opacity-60" : ""}`}>
                    <td className="p-3"><CopySaleId value={String(s.cufe || s._id)} /></td>
                    <td className="p-3 whitespace-nowrap"><p className="font-medium text-zinc-700">{formatDate(s.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</p><p className="mt-1 text-xs text-zinc-400">{formatTime(s.createdAt, { hour: "2-digit", minute: "2-digit", hour12: true })}</p></td>
                    <td className="p-3 text-right font-semibold tabular-nums text-zinc-900">{money(s.total)}</td>
                    <td className="p-3">
                      <span className={`whitespace-nowrap border text-xs px-2.5 py-0.5 rounded-full ${statusColors[s.dianStatus] || statusColors.NOT_EMITTED}`}>
                        {dianStatusLabels[s.dianStatus] || s.dianStatus}
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
                      {isDeliveryAppSale && (
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
                    <td className="p-3"><span title={s.branchId?.name} className="whitespace-nowrap rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{s.branchId?.name?.replace(/^Mecatos\s+el\s+Santi\s*[-–—:]?\s*/i, "") || s.branchId?.name || "—"}</span></td>
                    <td className="p-3 sticky right-0 z-10 bg-white border-l border-neutral-200">
                      <div className="flex justify-center">
                        <ActionsMenu
                          items={[
                            { label: "Ver detalle", onClick: () => setViewingSale(s) },
                            { label: "Descargar ticket", onClick: () => downloadTicket(s) },
                            { label: "Reemitir DIAN", disabled: true, title: "La API no dispone de una operación de reemisión manual", onClick: () => {} },
                            ...(!cancelled && isDeliveryAppSale && s.paymentStatus === "PENDING_PAYMENT"
                              ? [{ label: "Confirmar Pago", onClick: () => handleConfirmPayment(s) }]
                              : []),
                            ...(!cancelled ? [{ label: "Anular", danger: true, onClick: () => handleCancel(s) }] : []),
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
          onSaved={refresh}
        />
      )}

      {editingSale && (
        <SaleEditModal
          sale={editingSale}
          onClose={() => setEditingSale(null)}
          onSaved={refresh}
        />
      )}

      {viewingSale && (
        <SaleReceipt sale={viewingSale} onClose={() => setViewingSale(null)} />
      )}

      {pendingModalOpen && (
        <PendingDidiPaymentsModal
          branchId={selectedBranch || undefined}
          onClose={() => setPendingModalOpen(false)}
          onConfirmed={refresh}
        />
      )}
    </div>
  );
}
