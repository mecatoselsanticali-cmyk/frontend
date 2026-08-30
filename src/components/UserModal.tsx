import { useEffect, useState } from "react";
import { adminApi } from "../services/api";

interface UserModalProps {
  user?: any; // si viene, el modal edita en vez de crear
  initialBranchId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = {
  name: "",
  role: "CASHIER",
  branchId: "",
  email: "",
  password: "",
  pin: "",
};

export default function UserModal({ user, initialBranchId, onClose, onSaved }: UserModalProps) {
  const isEditing = Boolean(user);
  const [branches, setBranches] = useState<any[]>([]);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState(
    user ? { ...user, branchId: user.branchId || "", password: "" } :
    { ...emptyForm, branchId: initialBranchId || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.listBranches({ pageSize: 100 }).then((res) => setBranches(res.data));
    adminApi.me().then(setMe);
  }, []);

  const isEditingSelf = isEditing && me !== null && String(user._id) === String(me.id);

  const submit = async () => {
    if (!form.name) {
      setError("El nombre es requerido");
      return;
    }
    // Un administrador no se asigna a ninguna sede; gerente y cajero sí.
    if (form.role !== "ADMIN" && !form.branchId) {
      setError("Selecciona la sede a la que tendrá acceso este usuario");
      return;
    }
    if (form.role === "CASHIER" && form.pin.length !== 4) {
      setError("El PIN de cajero debe tener 4 dígitos");
      return;
    }
    // La contraseña solo es obligatoria al CREAR — al editar, el backend ya
    // trata un password vacío como "no cambiar" (ver adminController.
    // updateUser: `if (password) doc.password = ...`), así que exigirla de
    // nuevo en cada edición sería forzar un cambio de contraseña no pedido.
    if (form.role !== "CASHIER" && (!form.email || (!isEditing && !form.password))) {
      setError(
        isEditing
          ? "El correo es requerido para administrador/gerente"
          : "Correo y contraseña son requeridos para administrador/gerente"
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      branchId: form.role === "ADMIN" ? undefined : form.branchId,
      // Un cajero no tiene campo de correo en este formulario — se queda
      // en "" por el estado inicial. Mandarlo tal cual choca contra el
      // índice único (sparse) de email en el backend en cuanto se crea un
      // segundo cajero sin correo (ver adminController.createUser).
      email: form.role === "CASHIER" ? undefined : form.email,
      // Password vacío = "no cambiar" — no lo mandamos en absoluto para
      // no pisar el hash existente con una cadena vacía.
      password: form.password || undefined,
    };

    try {
      if(isEditing) {
        await adminApi.updateUser(user._id, payload);
      } else {
        await adminApi.createUser(payload);
      }

      if (isEditingSelf) {
        // Si el admin acaba de editar su PROPIA cuenta (posiblemente su
        // correo/contraseña), la sesión actual queda con datos de login
        // obsoletos — se cierra la sesión para que vuelva a entrar con la
        // información nueva, en vez de dejarlo con un token válido pero
        // con credenciales que ya no coinciden con lo que hay en Mongo.
        try {
          await adminApi.logout();
        } catch {
          // si falla la llamada, igual mandamos al login
        }
        window.location.href = "/login";
        return;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 !m-0">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{ isEditing ? "Editar Usuario" : "Nuevo Usuario" }</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-neutral-400 hover:text-neutral-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {isEditingSelf && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Estás editando tu propia cuenta — al guardar, se cerrará tu sesión para que
              vuelvas a iniciar con la información actualizada.
            </p>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
              >
                <option value="CASHIER">Cajero</option>
                <option value="MANAGER">Gerente de sede</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            {form.role !== "ADMIN" && (
              <div>
                <label className="text-xs text-neutral-500">Sede con acceso</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.role === "CASHIER" ? (
              <div>
                <label className="text-xs text-neutral-500">PIN (4 dígitos)</label>
                <input
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                  className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs text-neutral-500">Correo</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-500">
                    Contraseña{isEditing && " (opcional)"}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={isEditing ? "Dejar en blanco para no cambiarla" : ""}
                    className="w-full border border-neutral-200 rounded-lg p-2 text-sm mt-1"
                  />
                </div>
              </>
            )}
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
              {saving ? "Guardando..." : isEditing ? "Actualizar usuario" : "Crear usuario"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
