import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import {
  todayColombia,
  addDaysToDateString,
  dayOfWeekForDateString,
  firstOfMonthForDateString,
} from "../utils/timezone";

// Paleta del proyecto (ver tailwind.config.js `brand.*`) + un par de
// neutros/acentos ya usados en otras pantallas (Ventas, Compras) — el
// dashboard reutiliza estos mismos tonos en vez de inventar una paleta
// nueva, para mantener consistencia visual (ver sección 5 del spec).
const CHART_COLORS = ["#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa", "#78716c"];
const BRAND = "#ea580c";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

// Todo el cálculo de rangos parte de `todayColombia()` (el día calendario
// de HOY en Bogotá, sin importar la zona horaria del navegador) y solo
// hace aritmética de strings "YYYY-MM-DD" desde ahí — antes esto usaba
// `Date` + `toISOString().slice(0,10)`, que da el día calendario en UTC:
// después de las 7pm hora Bogotá (UTC-5), UTC ya había cruzado a mañana,
// así que "Hoy" mostraba la fecha equivocada desde esa hora en adelante.
function computeRange(preset: DatePreset): { from: string; to: string } {
  const today = todayColombia();

  switch (preset) {
    case "yesterday": {
      const y = addDaysToDateString(today, -1);
      return { from: y, to: y };
    }
    case "week": {
      // Lunes de esta semana hasta hoy.
      const dayOfWeek = dayOfWeekForDateString(today); // 0=domingo
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = addDaysToDateString(today, -diffToMonday);
      return { from: start, to: today };
    }
    case "month": {
      return { from: firstOfMonthForDateString(today), to: today };
    }
    case "today":
    default:
      return { from: today, to: today };
  }
}

const presetLabels: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "custom", label: "Rango personalizado" },
];

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-100 p-5 animate-pulse ${className}`}>
      <div className="h-4 w-32 bg-neutral-200 rounded mb-4" />
      <div className="h-40 bg-neutral-100 rounded" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-neutral-400 text-center px-4">
      {message}
    </div>
  );
}

// Mismo breakpoint que Tailwind's `md:` (768px) — controla si el dashboard
// se arma en el grid de 3 columnas de siempre o en la pila con carruseles
// para celular. Se decide en JS (no solo `hidden md:block` en ambas
// versiones a la vez) para no montar cada widget dos veces — algunos son
// gráficos de Recharts, y aunque uno de los dos quede oculto con CSS,
// seguiría corriendo su propia lógica de ResizeObserver de fondo.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

/**
 * Carrusel horizontal con scroll-snap nativo (sin librería nueva) — cada
 * slide ocupa el ancho completo, se desliza con el dedo o tocando los
 * puntos de abajo. Se usa dos veces en el dashboard móvil (Top 5 productos
 * + Gastos por categoría; Métodos de pago + Ticket promedio) para no
 * apilar 4 widgets seguidos en una pantalla angosta.
 */
function Carousel({ slides }: { slides: React.ReactNode[] }) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ left: index * container.clientWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container || container.clientWidth === 0) return;
    setActive(Math.round(container.scrollLeft / container.clientWidth));
  };

  return (
    <div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((slide, i) => (
          <div key={i} className="w-full shrink-0 snap-center">
            {slide}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToIndex(i)}
            aria-label={`Ir a la diapositiva ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-colors ${
              active === i ? "bg-brand-600" : "bg-neutral-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const isMobile = useIsMobile();
  const [selectedBranch] = useSelectedBranch();
  const [preset, setPreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState(todayColombia());
  const [customTo, setCustomTo] = useState(todayColombia());
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return computeRange(preset);
  }, [preset, customFrom, customTo]);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getDashboardMetrics({ branchId: selectedBranch || undefined, from, to })
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, [selectedBranch, from, to]);

  const summary = metrics?.summary;
  const salesTimeline = metrics?.salesTimeline || [];
  const timelineGranularity: "hour" | "day" = metrics?.timelineGranularity || "hour";
  const topProducts = metrics?.topProducts || [];
  const expensesByCategory = metrics?.expensesByCategory || [];
  const paymentMethods = metrics?.paymentMethods || [];

  const hasSales = salesTimeline.some((h: any) => h.total > 0);
  const hasTopProducts = topProducts.length > 0;
  const hasExpenses = expensesByCategory.length > 0;

  // Cada widget se arma una sola vez acá y se reutiliza tal cual en el
  // layout de escritorio (grid de 3 columnas) o en la pila + carruseles de
  // celular (ver useIsMobile arriba) — así ningún gráfico de Recharts se
  // monta dos veces.
  const salesTimelineWidget = (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 h-full">
      <h3 className="font-semibold text-neutral-700 mb-3">
        Comportamiento de ventas ({timelineGranularity === "hour" ? "por hora" : "por día"})
      </h3>
      {!hasSales ? (
        <EmptyState message="No hay ventas registradas en el rango seleccionado" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={salesTimeline} margin={{ left: 8, right: 8 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND} stopOpacity={0.35} />
                <stop offset="95%" stopColor={BRAND} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toLocaleString("es-CO")}k`}
            />
            <Tooltip
              formatter={(v: number) => money(v)}
              labelFormatter={(label) => (timelineGranularity === "hour" ? `Hora: ${label}` : `Fecha: ${label}`)}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e5e5" }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={BRAND}
              strokeWidth={2}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const topProductsWidget = (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 h-full">
      <h3 className="font-semibold text-neutral-700 mb-3">Top 5 productos</h3>
      {!hasTopProducts ? (
        <EmptyState message="No hay productos vendidos en el rango seleccionado" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={topProducts}
              dataKey="quantity"
              nameKey="name"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {topProducts.map((_: any, i: number) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, _n, entry: any) => [`${v} uds. (${entry.payload.percentage}%)`, entry.payload.name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e5e5" }}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span className="text-neutral-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const expensesWidget = (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 h-full">
      <h3 className="font-semibold text-neutral-700 mb-3">Gastos por categoría</h3>
      {!hasExpenses ? (
        <EmptyState message="No hay gastos registrados en el rango seleccionado" />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={expensesByCategory}
              dataKey="amount"
              nameKey="category"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {expensesByCategory.map((_: any, i: number) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, _n, entry: any) => [`${money(v)} (${entry.payload.percentage}%)`, entry.payload.category]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e5e5" }}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span className="text-neutral-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const paymentMethodsWidget = (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 h-full">
      <h3 className="font-semibold text-neutral-700 mb-3">Transacciones por método de pago</h3>
      <div className="divide-y divide-neutral-50">
        {paymentMethods.map((m: any) => {
          const isReturns = m.method.startsWith("Devoluciones");
          return (
            <div key={m.method} className="flex justify-between items-center py-2 text-sm">
              <span className="text-neutral-500">{m.method}</span>
              <span className={`font-semibold ${isReturns ? "text-red-500" : "text-neutral-800"}`}>
                {isReturns && m.amount > 0 ? "-" : ""}
                {money(m.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const averageTicketWidget = (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 h-full">
      <h3 className="font-semibold text-neutral-700 mb-1">Ticket promedio</h3>
      <p className="text-2xl font-bold text-brand-600 mb-4">{money(summary?.averageTicket || 0)}</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Total bruto</span>
          <span className="font-medium">{money(summary?.grossTotal || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Descuentos</span>
          <span className="font-medium text-neutral-400">{money(summary?.discountTotal || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Impoconsumo (8%)</span>
          <span className="font-medium">{money(summary?.impoconsumoTotal || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500" title="Este sistema no distingue IVA del Impoconsumo hoy — todas las ventas usan una tasa plana del 8%.">
            IVA (19%)
          </span>
          <span className="font-medium text-neutral-400">{money(summary?.ivaTotal || 0)}</span>
        </div>
        <div className="flex justify-between pt-1.5 border-t border-neutral-100">
          <span className="font-semibold text-neutral-700">Total neto</span>
          <span className="font-bold text-brand-600">{money(summary?.netTotal || 0)}</span>
        </div>
        <div className="flex justify-between text-xs text-neutral-400 pt-1">
          <span>Transacciones</span>
          <span>{summary?.totalTransactions || 0}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Barra de filtros superior */}
      <div className="bg-white rounded-xl border border-neutral-100 p-3 flex flex-wrap items-center gap-3">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as DatePreset)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
        >
          {presetLabels.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {preset === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-neutral-400 text-sm">a</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            />
          </>
        )}

        <span className="text-xs text-neutral-400 ml-auto">
          La sede se filtra con el selector de la barra superior.
        </span>
      </div>

      {loading ? (
        isMobile ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <SkeletonCard className="col-span-2" />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )
      ) : isMobile ? (
        // Móvil: la venta por hora/día va arriba a ancho completo, y los
        // otros 4 widgets se agrupan en 2 carruseles de a 2 para no apilar
        // 4 tarjetas seguidas en una pantalla angosta (pedido explícito).
        <div className="space-y-4">
          {salesTimelineWidget}
          <Carousel slides={[topProductsWidget, expensesWidget]} />
          <Carousel slides={[paymentMethodsWidget, averageTicketWidget]} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">{salesTimelineWidget}</div>
          {topProductsWidget}
          {expensesWidget}
          {paymentMethodsWidget}
          {averageTicketWidget}
        </div>
      )}
    </div>
  );
}
