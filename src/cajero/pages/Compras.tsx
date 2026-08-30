import { useEffect, useState } from "react";
import { posApi } from "../services/posApi";
import { usePosStore } from "../store/posStore";
import PurchaseModal from "../components/PurchaseModal";
import ShiftRequiredNotice from "../components/ShiftRequiredNotice";

export default function Compras() {
  const shiftId = usePosStore((s) => s.shiftId);
  const shiftChecked = usePosStore((s) => s.shiftChecked);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = () => {
    setLoading(true);
    posApi
      .getPurchases()
      .then(setPurchases)
      .finally(() => setLoading(false));
  };

  // Solo carga si ya hay un turno abierto — igual que Facturas.tsx.
  useEffect(() => {
    if (shiftId) load();
  }, [shiftId]);

  if (shiftChecked && !shiftId) {
    return <ShiftRequiredNotice />;
  }

  const total = purchases.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="h-full overflow-y-auto p-6 bg-neutral-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">Compras de tu turno</h2>
          <p className="text-sm text-neutral-500">
            {purchases.length} registro(s) · ${total.toLocaleString("es-CO")}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nueva compra
        </button>
      </div>

      {loading && <p className="text-neutral-400 text-sm">Cargando...</p>}

      {!loading && purchases.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-100 p-8 text-center text-neutral-400">
          Aún no has registrado compras en este turno
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
        {purchases.map((p, i) => (
          <div
            key={p._id}
            className={`p-4 flex items-center gap-3 ${i > 0 ? "border-t border-neutral-50" : ""}`}
          >
            <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden flex items-center justify-center shrink-0">
              {/* receiptImageUrl solo existe en compras informales de antes de este
                  cambio (ver CLAUDE.md) — el ícono cubre las compras nuevas. */}
              {p.receiptImageUrl ? (
                <img src={p.receiptImageUrl} alt="Recibo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-neutral-300">📦</span>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{p.supplierName}</div>
              <div className="text-xs text-neutral-400">
                {p.concept}
                {p.productId && p.quantity && ` · ${p.productId.name} x${p.quantity}`}
              </div>
            </div>
            <div className="text-sm font-semibold">${p.amount.toLocaleString("es-CO")}</div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <PurchaseModal onClose={() => setModalOpen(false)} onSaved={load} />
      )}
    </div>
  );
}
