// Único punto de verdad para "zona horaria de Colombia" en el panel admin
// (ver backend/src/utils/dateRange.ts para el equivalente del backend, y
// cajero/utils/timezone.ts para la copia intencional de este mismo
// archivo dentro de src/cajero/ — ver punto 12 de CLAUDE.md).
//
// El negocio es 100% en Colombia — todo lo que se MUESTRA (recibos,
// tablas de ventas/compras, reportes) debe verse en hora de Bogotá sin
// importar en qué zona horaria esté configurado el navegador/SO de quien
// lo esté viendo (un admin revisando desde otro país no debería ver un
// ticket con una hora distinta a la que el cajero vio al imprimirlo).
export const COLOMBIA_TIME_ZONE = "America/Bogota";

/**
 * Reemplazo de `new Date(x).toLocaleString("es-CO")` — con `timeZone`
 * explícito para que el resultado no dependa del reloj/zona horaria del
 * navegador de quien lo esté viendo.
 */
export function formatDateTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString("es-CO", { timeZone: COLOMBIA_TIME_ZONE, ...options });
}

export function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("es-CO", { timeZone: COLOMBIA_TIME_ZONE, ...options });
}

export function formatTime(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleTimeString("es-CO", { timeZone: COLOMBIA_TIME_ZONE, ...options });
}

/**
 * El día calendario de HOY en Bogotá, como "YYYY-MM-DD" — reemplazo
 * directo de `new Date().toISOString().slice(0, 10)`, que en realidad da
 * el día calendario en UTC, no en Bogotá: a partir de las 7pm hora
 * Bogotá (UTC-5), UTC ya cruzó a las 00:00 del día siguiente, así que
 * ese patrón hacía que "Hoy" mostrara la fecha de mañana desde esa hora
 * en adelante (el bug real que motivó este archivo). `en-CA` da el
 * formato `YYYY-MM-DD` directo sin tener que reordenar `DD/MM/YYYY`.
 */
export function todayColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: COLOMBIA_TIME_ZONE });
}

/** Cualquier instante → su día calendario en Bogotá, como "YYYY-MM-DD". */
export function toColombiaDateInput(date: Date | string | number): string {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: COLOMBIA_TIME_ZONE });
}

/**
 * Suma/resta días a un string "YYYY-MM-DD" sin pasar nunca por la zona
 * horaria local del navegador — construye el punto de partida con
 * `Date.UTC` (mediodía/medianoche UTC de ESE año-mes-día, tratado como
 * una fecha calendario pura, no como un instante de Bogotá) y avanza con
 * los setters `UTC*`. Bogotá no tiene horario de verano, así que la
 * aritmética de calendario es la misma sea cual sea el offset real —
 * evitar `Date` local acá es solo para no heredar el timezone del
 * navegador en el resultado.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

/** Día de la semana (0=domingo) de un string "YYYY-MM-DD", sin depender
 * de la zona horaria local del navegador — mismo truco de `Date.UTC`. */
export function dayOfWeekForDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Primer día del mes de un string "YYYY-MM-DD", como "YYYY-MM-01". */
export function firstOfMonthForDateString(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}