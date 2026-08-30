import { useEffect, useState } from "react";
import { adminApi } from "../services/api";

export default function DianConfig() {
  const [branches, setBranches] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => adminApi.listBranches({ pageSize: 100 }).then((res) => setBranches(res.data));

  useEffect(() => {
    load();
  }, []);

  const selectBranch = (id: string) => {
    const branch = branches.find((b) => b._id === id);
    setSelected(branch ? { ...branch, dianConfig: { ...branch.dianConfig } } : null);
    setMessage("");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      await adminApi.updateBranch(selected._id, {
        dianConfig: selected.dianConfig,
        dailyCap: selected.dailyCap,
      });
      setMessage("Configuración guardada correctamente");
      load();
    } catch (err: any) {
      setMessage(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <select
        onChange={(e) => selectBranch(e.target.value)}
        className="border border-neutral-200 rounded-lg px-3 py-2 text-sm w-full"
        defaultValue=""
      >
        <option value="" disabled>
          Selecciona una sede para configurar
        </option>
        {branches.map((b) => (
          <option key={b._id} value={b._id}>
            {b.name}
          </option>
        ))}
      </select>

      {selected && (
        <div className="bg-white rounded-xl border border-neutral-100 p-6 space-y-4">
          <h3 className="font-semibold text-neutral-700">Numeración y resolución DIAN</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-500">Prefijo</label>
              <input
                value={selected.dianConfig.prefix || ""}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    dianConfig: { ...selected.dianConfig, prefix: e.target.value },
                  })
                }
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">N° Resolución</label>
              <input
                value={selected.dianConfig.resolutionNumber || ""}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    dianConfig: { ...selected.dianConfig, resolutionNumber: e.target.value },
                  })
                }
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Rango desde</label>
              <input
                type="number"
                value={selected.dianConfig.from || 0}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    dianConfig: { ...selected.dianConfig, from: Number(e.target.value) },
                  })
                }
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Rango hasta</label>
              <input
                type="number"
                value={selected.dianConfig.to || 0}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    dianConfig: { ...selected.dianConfig, to: Number(e.target.value) },
                  })
                }
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-neutral-500">Tope operativo diario (COP)</label>
              <input
                type="number"
                value={selected.dailyCap || 0}
                onChange={(e) => setSelected({ ...selected, dailyCap: Number(e.target.value) })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
          </div>

          {message && <p className="text-sm text-neutral-500">{message}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      )}
    </div>
  );
}
