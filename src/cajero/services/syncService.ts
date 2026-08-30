import { offlineDb } from "../db/offlineDb";
import { posApi } from "./posApi";

let syncing = false;

/**
 * Envía todas las ventas pendientes (synced=false) al backend en un solo lote.
 * Se ejecuta automáticamente al recuperar conexión y periódicamente como respaldo.
 */
export async function syncPendingSales() {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  try {
    // Nota: IndexedDB no soporta `boolean` como tipo de clave para índices,
    // así que filtramos en JS en vez de usar `.where("synced").equals(...)`
    // (el volumen de ventas offline en cola es pequeño, esto es barato).
    const pending = await offlineDb.sales.filter((sale) => sale.synced === false).toArray();
    if (pending.length === 0) return;

    const { results } = await posApi.syncBatch(pending);

    for (const result of results) {
      if (result.status === "SYNCED" || result.status === "ALREADY_SYNCED") {
        await offlineDb.sales.update(result.localTicketId, { synced: true });
      }
      // Si status === "ERROR", se deja pendiente para reintentar en el siguiente ciclo
    }
  } catch (err) {
    console.warn("[Sync] No se pudo sincronizar (se reintentará):", err);
  } finally {
    syncing = false;
  }
}

export function startSyncListener() {
  window.addEventListener("online", syncPendingSales);
  // Respaldo: reintenta cada 30s por si el evento 'online' no dispara en algunos navegadores
  setInterval(syncPendingSales, 30_000);
}
