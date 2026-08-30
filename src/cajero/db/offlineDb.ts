import Dexie, { Table } from "dexie";

export interface OfflineSaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: { name: string; extraPrice: number }[];
  subtotal: number;
}

export interface OfflineSale {
  localTicketId: string; // uuid generado en cliente, evita duplicados al sincronizar
  items: OfflineSaleItem[];
  paymentMethod: "CASH" | "NEQUI" | "CARD" | "DELIVERY_APP";
  orderType: "POS_COUNTER" | "RAPPI" | "DIDI" | "DELIVERY_LOCAL";
  customer?: { name?: string; document?: string; email?: string };
  total: number;
  createdAt: number; // epoch ms
  synced: boolean;
}

export interface CachedProduct {
  _id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  imageUrl?: string;
  modifiers: { name: string; extraPrice: number }[];
}

class MecatosOfflineDB extends Dexie {
  sales!: Table<OfflineSale, string>;
  products!: Table<CachedProduct, string>;

  constructor() {
    super("mecatos_pos_offline");
    this.version(1).stores({
      // localTicketId como clave primaria; índice por 'synced' para la cola de sincronización
      sales: "localTicketId, synced, createdAt",
      products: "_id, category",
    });
  }
}

export const offlineDb = new MecatosOfflineDB();

export function generateLocalTicketId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
