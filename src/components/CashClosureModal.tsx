import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminApi } from "../services/api";

interface CashClosureModalProps {
  closure?: any; // si viene, el modal edita en vez de crear
  initialBranchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const toLocalInput = (value?: string | Date) => {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = {
  branchId: "",
  cashierId: "",
  openedAt: toLocalInput(new Date()),
  closedAt: "",
  initialCash: "",
  initialNequi: "",
  declaredCash: "",
  systemCalculatedCash: "",
  cardTotal: "",
  nequiTotal: "",
  appsTotal: "",
  pettyCashExpenses: "",
  reportType: "Z",
  status: "CLOSED",
};

/**
 * Alta/edición manual de un registro de apertura/cierre de caja
 * (`CashClosure`) desde Finanzas > Caja. A diferencia del arqueo ciego
 * automático del POS del cajero (`openShift`/`closeShift`), acá el
 * admin/gerente puede capturar o corregir cualquier campo directamente —
 * pensado para turnos que no se abrieron/cerraron desde el POS, o para
 * corregir un dato mal reportado.
 */
export default function CashClosureModal({ closure, initialBranchId, onClose, onSaved }: CashClosureModalProps) {
  const isEditing = Boolean(closure);
  const [branches, setBranches] = useState<any[]>([]);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [me, setMe] = useState<{ role: string; branchId?: string } | null>(null);

  const [form, setForm] = useState(
    closure
      ? {
          branchId: closure.branchId?._id || closure.branchId || "",
          cashierId: closure.cashierId?._id || closure.cashierId || "",
          openedAt: toLocalInput(closure.openedAt),
          closedAt: toLocalInput(closure.closedAt),
          initialCash: String(closure.initialCash ?? ""),
          initialNequi: String(closure.initialNequi ?? ""),
          declaredCash: closure.declaredCash !== undefined && closure.declaredCash !== null ? String(closure.declaredCash) : "",
          systemCalculatedCash:
            closure.systemCalculatedCash !== undefined && closure.systemCalculatedCash !== null
              ? String(closure.systemCalculatedCash)
              : "",
          cardTotal: String(closure.cardTotal ?? ""),
          nequiTotal: String(closure.nequiTotal ?? ""),
          appsTotal: String(closure.appsTotal ?? ""),
          pettyCashExpenses: String(closure.pettyCashExpenses ?? ""),
          reportType: closure.reportType || "Z",
          status: closure.status || "CLOSED",
        }
      : { ...emptyForm, branchId: initialBranchId || "" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isManager = me?.role === "MANAGER";

  useEffect(() => {
    adminApi.me().then(setMe);
    adminApi.listBranches({ pageSize: 100 }).then((res) => setBranches(res.data));
  }, []);

  // Un gerente siempre queda fijo a su propia sede — apenas se sabe el rol.
  useEffect(() => {
    if (isManager && me?.branchId && !isEditing) {
      setForm((f) => ({ ...f, branchId: String(me.branchId) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager, me?.branchId]);

  // Recarga la lista de cajeros cada vez que cambia la sede elegida en el formulario.
  useEffect(() => {
    if (!form.branchId) {
      setCashiers([]);
      return;
    }
    adminApi.listCashiersForClosures(form.branchId).then(setCashiers).catch(() => setCashiers([]));
  }, [form.branchId]);

  const submit = async () => {
    if (!form.branchId || !form.cashierId || !form.openedAt) {
      setError("Sede, cajero y fecha de apertura son requeridos");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      branchId: form.branchId,
      cashierId: form.cashierId,
      openedAt: form.openedAt,
      closedAt: form.closedAt || undefined,
      initialCash: form.initialCash,
      initialNequi: form.initialNequi,
      declaredCash: form.declaredCash,
      systemCalculatedCash: form.systemCalculatedCash,
      cardTotal: form.cardTotal,
      nequiTotal: form.nequiTotal,
      appsTotal: form.appsTotal,
      pettyCashExpenses: form.pettyCashExpenses,
      reportType: form.reportType,
      status: form.status,
    };

    try {
      if (isEditing) {
        await adminApi.updateCashClosure(closure._id, payload);
      } else {
        await adminApi.createCashClosure(payload);
      }
      Swal.fire({ title: "Registro guardado", icon: "success", timer: 1500, showConfirmButton: false });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el registro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">
              {isEditing ? "Editar registro de caja" : "Nuevo registro de caja"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Sede</label>
              {isManager ? (
                <p className="w-full border border-neutral-100 bg-neutral-50 rounded-lg p-2 text-sm mt-1 text-neutral-600">
                  {branches.find((b) => b._id === form.branchId)?.name || "Tu sede"}
                </p>
              ) : (
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value, cashierId: "" })}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                >
                  <option value="">Selecciona...</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs text-neutral-500">Cajero</label>
              <select
                value={form.cashierId}
                onChange={(e) => setForm({ ...form, cashierId: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                disabled={!form.branchId}
              >
                <option value="">Selecciona...</option>
                {cashiers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Fecha apertura</label>
              <input
                type="datetime-local"
                value={form.openedAt}
                onChange={(e) => setForm({ ...form, openedAt: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Fecha cierre (opcional)</label>
              <input
                type="datetime-local"
                value={form.closedAt}
                onChange={(e) => setForm({ ...form, closedAt: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Base de efectivo</label>
              <input
                type="number"
                min={0}
                value={form.initialCash}
                onChange={(e) => setForm({ ...form, initialCash: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Base Nequi</label>
              <input
                type="number"
                min={0}
                value={form.initialNequi}
                onChange={(e) => setForm({ ...form, initialNequi: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Efectivo declarado al cierre</label>
              <input
                type="number"
                min={0}
                value={form.declaredCash}
                onChange={(e) => setForm({ ...form, declaredCash: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Efectivo esperado (sistema)</label>
              <input
                type="number"
                min={0}
                value={form.systemCalculatedCash}
                onChange={(e) => setForm({ ...form, systemCalculatedCash: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Total tarjeta</label>
              <input
                type="number"
                min={0}
                value={form.cardTotal}
                onChange={(e) => setForm({ ...form, cardTotal: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Total Nequi</label>
              <input
                type="number"
                min={0}
                value={form.nequiTotal}
                onChange={(e) => setForm({ ...form, nequiTotal: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Total apps</label>
              <input
                type="number"
                min={0}
                value={form.appsTotal}
                onChange={(e) => setForm({ ...form, appsTotal: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-neutral-500">Gastos de caja menor</label>
              <input
                type="number"
                min={0}
                value={form.pettyCashExpenses}
                onChange={(e) => setForm({ ...form, pettyCashExpenses: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Tipo de reporte</label>
              <select
                value={form.reportType}
                onChange={(e) => setForm({ ...form, reportType: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="Z">Z (cierre final)</option>
                <option value="X">X (corte intermedio)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="OPEN">Abierto</option>
                <option value="CLOSED">Cerrado</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 bg-neutral-100 rounded-lg py-2 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear registro"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
