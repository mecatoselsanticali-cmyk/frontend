import { useEffect, useState } from "react";
import { adminApi } from "../services/api";
import { useSelectedBranch } from "../layout/Layout";
import DataTable from "../components/DataTable";
import { formatDate } from "../utils/timezone";

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  PARTIAL: "bg-blue-50 text-blue-600",
  PAID: "bg-green-50 text-green-600",
  OVERDUE: "bg-red-50 text-red-600",
};

export default function CuentasPorCobrar() {
  const [selectedBranch] = useSelectedBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: "", totalAmount: "", dueDate: "" });
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedBranch) params.branchId = selectedBranch;
    adminApi
      .listReceivables(params)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch]);

  const submit = async () => {
    if (!selectedBranch) {
      setError("Selecciona una sede en la barra superior");
      return;
    }
    if (!form.customerName || !form.totalAmount || !form.dueDate) {
      setError("Completa todos los campos");
      return;
    }
    try {
      await adminApi.createReceivable({
        branchId: selectedBranch,
        customerName: form.customerName,
        totalAmount: Number(form.totalAmount),
        dueDate: form.dueDate,
      });
      setShowForm(false);
      setForm({ customerName: "", totalAmount: "", dueDate: "" });
      setError("");
      load();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar el crédito");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-neutral-500 text-sm">Créditos a clientes corporativos / eventos</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nuevo crédito
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4 grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs text-neutral-500">Cliente</label>
            <input
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Monto total</label>
            <input
              type="number"
              value={form.totalAmount}
              onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Vencimiento</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <button onClick={submit} className="bg-brand-600 text-white rounded-lg py-2 text-sm font-medium">
            Guardar
          </button>
          {error && <p className="col-span-4 text-red-500 text-xs">{error}</p>}
        </div>
      )}

      <DataTable
        loading={loading}
        rows={rows}
        emptyMessage="No hay cuentas por cobrar registradas"
        columns={[
          { key: "customerName", label: "Cliente" },
          {
            key: "totalAmount",
            label: "Total",
            render: (r) => `$${r.totalAmount.toLocaleString("es-CO")}`,
          },
          {
            key: "paidAmount",
            label: "Abonado",
            render: (r) => `$${r.paidAmount.toLocaleString("es-CO")}`,
          },
          {
            key: "dueDate",
            label: "Vence",
            render: (r) => formatDate(r.dueDate),
          },
          {
            key: "status",
            label: "Estado",
            render: (r) => (
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[r.status]}`}>
                {r.status}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
