import { create } from "zustand";
import { CachedProduct } from "../db/offlineDb";

export interface OrderLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: { name: string; extraPrice: number }[];
  subtotal: number;
}

export type ModalType = "EXPENSE" | "SHIFT" | "CUSTOMER" | "CASH_PAYMENT" | "INVOICE_PROMPT" | null;

interface PosState {
  // Sesión
  branchId: string | null;
  branchName: string | null;
  cashierId: string | null;
  cashierName: string | null;

  // Catálogo
  products: CachedProduct[];
  activeCategory: string | null;

  // Orden activa
  order: OrderLine[];

  // Turno — id del CashClosure OPEN del cajero, o null si no tiene uno
  // abierto. `shiftChecked` distingue "todavía no sabemos" (recién montó
  // Caja.tsx, esperando la respuesta de GET /api/pos/shifts/current) de
  // "ya confirmamos que no hay turno abierto" — sin esto, Caja.tsx no
  // podría diferenciar esos dos casos y arriesgaría mostrar el bloqueo de
  // "Iniciar turno" por un instante aunque sí haya uno abierto.
  shiftId: string | null;
  shiftChecked: boolean;

  // UI
  activeModal: ModalType;

  // Acciones
  setSession: (data: { branchId: string; branchName: string; cashierId: string; cashierName: string }) => void;
  clearSession: () => void;
  // Marca `shiftChecked: true` siempre — se usa tanto para la
  // confirmación inicial (con el id real o null) como para actualizar el
  // id tras abrir/cerrar un turno.
  setShiftId: (id: string | null) => void;
  setProducts: (products: CachedProduct[]) => void;
  setActiveCategory: (category: string | null) => void;
  addToOrder: (product: CachedProduct, modifiers?: { name: string; extraPrice: number }[]) => void;
  removeLine: (index: number) => void;
  updateLineQuantity: (index: number, quantity: number) => void;
  clearOrder: () => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  orderTotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  branchId: null,
  branchName: null,
  cashierId: null,
  cashierName: null,

  products: [],
  activeCategory: null,

  order: [],

  shiftId: null,
  shiftChecked: false,

  activeModal: null,

  setSession: ({ branchId, branchName, cashierId, cashierName }) =>
    set({ branchId, branchName, cashierId, cashierName }),

  clearSession: () =>
    set({
      branchId: null,
      branchName: null,
      cashierId: null,
      cashierName: null,
      order: [],
      shiftId: null,
      shiftChecked: false,
    }),

  setShiftId: (id) => set({ shiftId: id, shiftChecked: true }),

  setProducts: (products) => set({ products }),

  setActiveCategory: (category) => set({ activeCategory: category }),

  addToOrder: (product, modifiers = []) =>
    set((state) => {
      const modifiersTotal = modifiers.reduce((acc, m) => acc + m.extraPrice, 0);
      const unitPrice = product.price + modifiersTotal;

      const newLine: OrderLine = {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: 1,
        modifiers,
        subtotal: unitPrice,
      };

      return { order: [...state.order, newLine] };
    }),

  removeLine: (index) =>
    set((state) => ({ order: state.order.filter((_, i) => i !== index) })),

  updateLineQuantity: (index, quantity) =>
    set((state) => {
      const order = [...state.order];
      const line = order[index];
      if (!line || quantity < 1) return { order };
      const modifiersTotal = line.modifiers.reduce((acc, m) => acc + m.extraPrice, 0);
      order[index] = { ...line, quantity, subtotal: (line.price + modifiersTotal) * quantity };
      return { order };
    }),

  clearOrder: () => set({ order: [] }),

  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  orderTotal: () => get().order.reduce((acc, line) => acc + line.subtotal, 0),
}));
