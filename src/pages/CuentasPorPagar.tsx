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

export default function CuentasPorPagar() {
  const [selectedBranch] = useSelectedBranch();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    supplierName: "",
    invoiceNumber: "",
    totalAmount: "",
    dueDate: "",
  });
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedBranch) params.branchId = selectedBranch;
    adminApi
      .listPayables(params)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(load, [selectedBranch]);

  const submit = async () => {
    if (!selectedBranch) {
      setError("Selecciona una sede en la barra superior");
      return;
    }
    if (!form.supplierName || !form.invoiceNumber || !form.totalAmount || !form.dueDate) {
      setError("Completa todos los campos");
      return;
    }
    try {
      await adminApi.createPayable({
        branchId: selectedBranch,
        supplierName: form.supplierName,
        invoiceNumber: form.invoiceNumber,
        totalAmount: Number(form.totalAmount),
        dueDate: form.dueDate,
      });
      setShowForm(false);
      setForm({ supplierName: "", invoiceNumber: "", totalAmount: "", dueDate: "" });
      setError("");
      load();
    } catch (err: any) {
      setError(err.message || "No se pudo registrar la cuenta");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-neutral-500 text-sm">Deudas con proveedores</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nueva cuenta
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-neutral-100 p-4 grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-neutral-500">Proveedor</label>
            <input
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
              className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">N° Factura</label>
            <input
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
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
          {error && <p className="col-span-5 text-red-500 text-xs">{error}</p>}
        </div>
      )}

      <DataTable
        loading={loading}
        rows={rows}
        emptyMessage="No hay cuentas por pagar registradas"
        columns={[
          { key: "supplierName", label: "Proveedor" },
          { key: "invoiceNumber", label: "Factura" },
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
