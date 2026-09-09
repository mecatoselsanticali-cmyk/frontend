import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
import { CircleCheck, TriangleAlert } from "lucide-react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import { useAuthSession } from "../components/AuthProvider";
import { adminTourSteps } from "../onboarding/adminTourSteps";
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

// Mismo mapeo que ya existe en Gastos.tsx (duplicado ahí, no importado —
// cada página del panel mantiene su propia copia de estas etiquetas
// chicas, mismo criterio que `paymentMethodLabels` en Ventas.tsx) — sin
// esto, el widget de "Gastos por categoría" mostraba el valor crudo del
// enum de `Expense.category` (ej. "PETTY_CASH") en vez de en español.
const expenseCategoryLabels: Record<string, string> = {
  PETTY_CASH: "Caja menor",
  ARRIENDO: "Arriendo",
  NOMINA: "Nómina",
  SERVICIOS_PUBLICOS: "Servicios públicos",
  OTRO: "Otro",
};

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

// Tarjeta de KPI simple (Ventas/Compras/Gastos/Rentabilidad) — mismo
// patrón visual (`bg-white rounded-xl border`) que el resto de widgets de
// este dashboard, pero sin gráfico: solo una etiqueta y un monto grande.
function StatCard({ label, value, valueClassName = "text-neutral-800", isMobile }: { label: string; value: string; valueClassName?: string; isMobile?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-5">
      <h3 className="text-sm text-neutral-500 mb-1">{label}</h3>
      <p className={`${isMobile ? "text-lg" : "text-2xl"} font-bold ${valueClassName}`}>{value}</p>
    </div>
  );
}

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
  const navigate = useNavigate();
  const [selectedBranch] = useSelectedBranch();
  const { admin, completeOnboarding } = useAuthSession();
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

  // Tour de onboarding — arranca automáticamente al montar el Dashboard
  // (la pantalla de entrada de ADMIN/MANAGER) mientras
  // `hasCompletedOnboarding` sea `false`. Los 4 elementos objetivo viven
  // en Sidebar.tsx/Topbar.tsx (el shell de Layout.tsx), no en este
  // archivo — ya están montados en el DOM porque Dashboard es hijo de
  // Layout, nunca su hermano.
  useEffect(() => {
    if (!admin || admin.hasCompletedOnboarding) return;

    // Distingue un `destroy()` disparado por el usuario (terminó el tour,
    // tocó "Omitir", cerró con ×/Escape) de uno disparado por el cleanup
    // de este efecto (navegación fuera de /dashboard, o el doble-montaje
    // de React.StrictMode en dev) — solo el primero debe marcar el
    // onboarding como completado. Sin esto, el StrictMode de dev montaría
    // el tour, lo destruiría de inmediato en el cleanup del primer
    // montaje, y esa destrucción "falsa" ya habría llamado al PATCH antes
    // de que el segundo montaje (el real) llegara a mostrarlo.
    let dismissedByCleanup = false;

    const tourDriver = driver({
      showProgress: true,
      steps: adminTourSteps,
      onPopoverRender: (popover) => {
        const skipBtn = document.createElement("button");
        skipBtn.type = "button";
        skipBtn.textContent = "Omitir";
        skipBtn.className = "driver-popover-footer-btn";
        skipBtn.addEventListener("click", () => tourDriver.destroy());
        popover.footerButtons.prepend(skipBtn);
      },
      onDestroyed: () => {
        if (dismissedByCleanup) return;
        completeOnboarding();
        adminApi.completeOnboarding().catch(() => {
          // best-effort — si falla, el peor caso es que el tour vuelva a
          // aparecer en el próximo login, no es una operación crítica
        });
      },
    });

    tourDriver.drive();

    return () => {
      dismissedByCleanup = true;
      tourDriver.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin?.id, admin?.hasCompletedOnboarding]);

  const summary = metrics?.summary;
  const salesTimeline = metrics?.salesTimeline || [];
  const timelineGranularity: "hour" | "day" = metrics?.timelineGranularity || "hour";
  const topProducts = metrics?.topProducts || [];
  const expensesByCategory = (metrics?.expensesByCategory || []).map((e: any) => ({
    ...e,
    category: expenseCategoryLabels[e.category] || e.category,
  }));
  const paymentMethods = metrics?.paymentMethods || [];
  // Widget "Stock Crítico" (ver punto 62 de CLAUDE.md) — ya viene
  // ordenado ascendente por cantidad disponible (los más urgentes
  // primero) desde `getCriticalStockProducts` en el backend.
  const criticalStock = metrics?.criticalStock || [];

  // Ticks explícitos del eje X de "Comportamiento de ventas" cuando la
  // granularidad es por hora (24 puntos, "00:00".."23:00") — sin esto,
  // Recharts decide los ticks a mostrar por su cuenta con un algoritmo
  // que SIEMPRE fuerza el último punto (23:00) a quedar visible y reparte
  // los demás desde ahí, lo que rompe el espaciado parejo justo antes del
  // final (ej. en escritorio saltaba de "21:00" a "23:00", saltándose
  // "22:00" por completo — reportado como "no se ve la hora 22 en el
  // borde"). Un arreglo explícito de horas parejas (cada 2h en escritorio,
  // cada 4h en celular, donde cabe menos texto) evita ese salto y hace que
  // el espaciado sea siempre predecible.
  // Anclado a "22:00" hacia atrás (no desde "00:00" hacia adelante) —
  // Recharts, incluso con `ticks` explícitos, sigue forzando que el
  // ÚLTIMO valor del arreglo quede visible si el contenedor es angosto
  // (mismo comportamiento de "preservar el final" que causaba el bug,
  // solo que ahora aplicado sobre nuestra lista en vez de sobre las 24
  // horas crudas) — anclando en 22 en vez de 0, ese último-forzado
  // siempre termina siendo "22:00" sin importar el ancho de pantalla, en
  // vez de terminar en "20:00"/"23:00" según cuántos ticks quepan.
  const hourTickStep = isMobile ? 4 : 2;
  const hourTicks =
    timelineGranularity === "hour"
      ? Array.from({ length: Math.floor(22 / hourTickStep) + 1 }, (_, i) => {
          const hour = 22 - i * hourTickStep;
          return `${String(hour).padStart(2, "0")}:00`;
        }).reverse()
      : undefined;

  const hasSales = salesTimeline.some((h: any) => h.total > 0);
  const hasTopProducts = topProducts.length > 0;
  const hasExpenses = expensesByCategory.length > 0;
  const hasCriticalStock = criticalStock.length > 0;

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
          <AreaChart data={salesTimeline} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={BRAND} stopOpacity={0.35} />
                <stop offset="95%" stopColor={BRAND} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              axisLine={false}
              tickLine={false}
              ticks={hourTicks}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              axisLine={false}
              tickLine={false}
              // Recharts reserva 60px para el eje Y por default sin
              // importar cuánto mida el texto real de los ticks ("$20k"
              // no necesita eso) — en celular, con el widget a ~340px de
              // ancho, ese sobrante se veía como un padding grande a la
              // izquierda del gráfico. 40px alcanza sin recortar el texto
              // más largo ("$20k") en ninguno de los dos tamaños.
              width={40}
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
              // 11px era difícil de leer — mismo tamaño en las dos leyendas
              // de este dashboard (Top 5 productos / Gastos por categoría),
              // ver punto correspondiente si se vuelve a tocar cualquiera
              // de las dos, para que no queden desincronizadas de nuevo.
              wrapperStyle={{ fontSize: 13, lineHeight: "20px" }}
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
          <BarChart data={expensesByCategory} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f0" vertical={false} />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              axisLine={false}
              tickLine={false}
              // 40px (sin margin.left) recortaba el "$" de los ticks del
              // medio (ej. "19,5M") — más anchos que los de punta ("$26M"/
              // "$0M") por el decimal con coma. Recharts alinea el texto
              // del eje Y contra la línea del eje (a la derecha); si el
              // texto no entra en el ancho reservado, el sobrante se va
              // hacia la izquierda y, sin margen que lo absorba, quedaba
              // cortado por el borde del SVG — el primer carácter que se
              // pierde es justo el "$", al ser el más a la izquierda.
              // 48px + el `margin.left: 8` de arriba dan espacio de sobra
              // para el tick más largo esperado ("$100M" o similar).
              width={48}
              tickFormatter={(v) => `$${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M`}
            />
            <Tooltip
              formatter={(v: number, _n, entry: any) => [`${money(v)} (${entry.payload.percentage}%)`, "Gasto"]}
              labelFormatter={(label) => label}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e5e5" }}
            />
            <Bar dataKey="amount" fill={BRAND} radius={[4, 4, 0, 0]} />
          </BarChart>
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

  // Resumen Ventas/Compras/Gastos/Rentabilidad — mismo rango de fechas y
  // sede que el resto del dashboard (viene todo de `summary`, ya filtrado
  // por el backend). Rentabilidad = ventas - compras - gastos, ver punto
  // 54 de CLAUDE.md; puede dar negativo (sede con más gasto que venta en
  // el rango elegido), de ahí el color condicional.
  const profitability = summary?.profitability ?? 0;
  const statsWidget = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard label="Ventas" value={money(summary?.netTotal || 0)} isMobile={isMobile} />
      <StatCard label="Compras" value={money(summary?.totalPurchases || 0)} isMobile={isMobile} />
      <StatCard label="Gastos" value={money(summary?.totalExpenses || 0)} isMobile={isMobile} />
      <StatCard
        label="Rentabilidad"
        value={profitability < 0 ? `-${money(Math.abs(profitability))}` : money(profitability)}
        valueClassName={profitability < 0 ? "text-red-500" : "text-green-600"}
        isMobile={isMobile}
      />
    </div>
  );

  // Widget "Stock Crítico" (ver punto 62 de CLAUDE.md) — reemplaza al
  // viejo "Ticket promedio" (quitado por completo, no solo oculto: el
  // pedido explícito fue reemplazar la tarjeta, no agregar una quinta).
  // A diferencia del resto de widgets de este dashboard, NO depende de
  // `from`/`to` — el stock es una foto del momento actual, ver el
  // comentario del backend en `getCriticalStockProducts`. Solo respeta
  // la sede elegida en la topbar.
  const criticalStockWidget = (
    <div className="bg-white rounded-xl border border-neutral-100 p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="font-semibold text-neutral-700">Stock Crítico</h3>
        {hasCriticalStock && (
          <span className="shrink-0 text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded-full">
            {criticalStock.length} {criticalStock.length === 1 ? "producto en riesgo" : "productos en riesgo"}
          </span>
        )}
      </div>

      {!hasCriticalStock ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <CircleCheck className="text-green-500 mb-2" size={32} />
          <p className="text-sm text-neutral-500">Todo el inventario está al día</p>
        </div>
      ) : (
        <div className="flex-1 max-h-52 overflow-y-auto space-y-1 pr-1">
          {criticalStock.map((p: any) => {
            const isOut = p.quantity <= 0;
            // `minStock` puede ser 0 (sin umbral configurado) para un
            // producto que igual aparece acá por estar en 0 unidades
            // (ver getCriticalStockProducts, backend) — mostrar "0 / 0
            // unds" en ese caso es confuso (sugiere un umbral real de 0),
            // así que sin umbral configurado se muestra "Sin stock" en
            // vez del formato "cantidad / mínimo".
            const hasThreshold = p.minStock > 0;
            return (
              <div
                key={p.productId}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-neutral-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-700 truncate">{p.name}</p>
                  <p className="text-xs text-neutral-400">{p.sku}</p>
                </div>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                    isOut ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  }`}
                >
                  {hasThreshold ? `${p.quantity} / ${p.minStock} unds` : "Sin stock"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/inventario?lowStock=true")}
        className="mt-3 pt-2.5 border-t border-neutral-100 text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center justify-center gap-1"
      >
        <TriangleAlert size={14} />
        Ir a Inventario
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Barra de filtros superior */}
      <div className="bg-white rounded-xl border border-neutral-100 p-3 flex flex-wrap items-center gap-3">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as DatePreset)}
          className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
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
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
            <span className="text-neutral-400 text-sm">a</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-base"
            />
          </>
        )}

        <span className="text-xs text-neutral-400 ml-auto">
          La sede se filtra con el selector de la barra superior.
        </span>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          {isMobile ? (
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
          )}
        </div>
      ) : isMobile ? (
        // Móvil: Ventas/Compras/Gastos/Rentabilidad van arriba en un grid
        // 2x2 (ya son 4 tarjetas simples, no necesitan carrusel), luego la
        // venta por hora/día a ancho completo, y los otros 4 widgets se
        // agrupan en 2 carruseles de a 2 para no apilar 4 tarjetas seguidas
        // en una pantalla angosta (pedido explícito).
        <div className="space-y-4">
          {statsWidget}
          {salesTimelineWidget}
          <Carousel slides={[topProductsWidget, expensesWidget]} />
          <Carousel slides={[paymentMethodsWidget, criticalStockWidget]} />
        </div>
      ) : (
        <div className="space-y-4">
          {statsWidget}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">{salesTimelineWidget}</div>
            {topProductsWidget}
            {expensesWidget}
            {paymentMethodsWidget}
            {criticalStockWidget}
          </div>
        </div>
      )}
    </div>
  );
}
