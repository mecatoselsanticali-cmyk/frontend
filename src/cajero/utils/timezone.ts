// Copia intencional de ../../utils/timezone.ts (ver punto 12 de CLAUDE.md:
// src/cajero/ no importa nada de fuera de sí mismo). Único punto de
// verdad para "zona horaria de Colombia" dentro de la zona cajero.
//
// El negocio es 100% en Colombia — todo lo que se MUESTRA (recibos,
// facturas, compras) debe verse en hora de Bogotá sin importar en qué
// zona horaria esté configurado el navegador/SO de quien lo esté viendo.
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
 * el día calendario en UTC, no en Bogotá (ver admin-frontend/src/utils/
 * timezone.ts para el detalle completo del bug que esto evita).
 */
export function todayColombia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: COLOMBIA_TIME_ZONE });
}

/** Cualquier instante → su día calendario en Bogotá, como "YYYY-MM-DD". */
export function toColombiaDateInput(date: Date | string | number): string {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: COLOMBIA_TIME_ZONE });
}