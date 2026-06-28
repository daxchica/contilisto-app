// src/pages/admin/AdminUsersPage.tsx
import { useEffect, useState } from "react";
import { fetchUsers, updateUser, createAdminUser, deleteAdminUser, verifyAdminUser } from "@/services/adminUserService";
import type { UserRole } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import type { AdminUser } from "@/services/adminUserService";

const ROLES: UserRole[] = ["user", "admin", "master", "owner"];
const PLANS = ["estudiante", "contador", "corporativo"];

const emptyForm = { email: "", password: "", role: "user" as UserRole, planKey: "estudiante" };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [verifyingUid, setVerifyingUid] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const { user: currentUser } = useAuth();
  const isMaster = currentUser?.role === "master" || currentUser?.role === "owner";

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  // ============================================================
  // UPDATE HANDLER
  // ============================================================
  const handleUpdate = async (
    uid: string,
    data: Partial<{ role: UserRole; planKey: string; planStatus: "active" | "inactive"; isTestAccount: boolean }>
  ) => {
    try {
      setSavingUid(uid);
      await updateUser(uid, data);
      setUsers(prev => prev.map(u => (u.uid === uid ? { ...u, ...data } : u)));
    } catch (err: any) {
      alert(err.message ?? "Error guardando cambios");
    } finally {
      setSavingUid(null);
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    const ok = confirm(
      `¿Seguro que deseas ${u.planStatus === "active" ? "desactivar" : "activar"} este usuario?`
    );
    if (!ok) return;
    await handleUpdate(u.uid, { planStatus: u.planStatus === "active" ? "inactive" : "active" });
  };

  // ============================================================
  // DELETE HANDLER
  // ============================================================
  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`¿Eliminar permanentemente a ${u.email}? Esta acción no se puede deshacer.`)) return;
    try {
      setDeletingUid(u.uid);
      await deleteAdminUser(u.uid);
      setUsers(prev => prev.filter(x => x.uid !== u.uid));
    } catch (err: any) {
      alert(err.message ?? "Error eliminando usuario");
    } finally {
      setDeletingUid(null);
    }
  };

  // ============================================================
  // VERIFY EMAIL HANDLER (fix admin-created users who can't log in)
  // ============================================================
  const handleVerify = async (u: AdminUser) => {
    if (!confirm(`¿Marcar el correo de ${u.email} como verificado para que pueda ingresar?`)) return;
    try {
      setVerifyingUid(u.uid);
      await verifyAdminUser(u.uid);
      alert(`Email de ${u.email} verificado correctamente.`);
    } catch (err: any) {
      alert(err.message ?? "Error verificando usuario");
    } finally {
      setVerifyingUid(null);
    }
  };

  // ============================================================
  // CREATE HANDLER
  // ============================================================
  const handleCreate = async () => {
    setFormError("");
    if (!form.email || !form.password) {
      setFormError("Email y contraseña son requeridos.");
      return;
    }
    if (form.password.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    try {
      setFormLoading(true);
      const uid = await createAdminUser(form);
      setUsers(prev => [
        ...prev,
        { uid, email: form.email, role: form.role, planKey: form.planKey, planStatus: "active" },
      ]);
      setShowAddModal(false);
      setForm(emptyForm);
    } catch (err: any) {
      setFormError(err.message ?? "Error creando usuario");
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <p className="p-6">Cargando usuarios…</p>;

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl sm:text-2xl font-bold">Usuarios</h1>
        {isMaster && (
          <button
            onClick={() => { setShowAddModal(true); setFormError(""); setForm(emptyForm); }}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
          >
            + Agregar
          </button>
        )}
      </div>

      {/* ── MOBILE: card list ── */}
      <div className="sm:hidden flex flex-col gap-3">
        {users.map(u => {
          const isSelf = u.uid === currentUser?.uid;
          const isProtected = isSelf && (u.role === "master" || u.role === "owner");
          const isSaving = savingUid === u.uid;

          return (
            <div key={u.uid} className="border rounded-xl p-4 bg-gray-50 space-y-3">
              {/* Email row */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{u.email}</span>
                {isSelf && <span className="text-xs text-slate-400 shrink-0">(tú)</span>}
              </div>

              {/* Rol + Plan */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Rol</p>
                  <select
                    value={u.role}
                    disabled={isProtected || isSaving}
                    onChange={e => handleUpdate(u.uid, { role: e.target.value as UserRole })}
                    className="w-full border rounded px-2 py-1 text-sm bg-white"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {isProtected && <p className="text-xs text-slate-400 mt-0.5">protegida</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Plan</p>
                  <select
                    value={u.planKey ?? "estudiante"}
                    disabled={isSaving}
                    onChange={e => handleUpdate(u.uid, { planKey: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm bg-white"
                  >
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Estado + Delete */}
              <div className="flex items-center justify-between gap-2">
                <button
                  disabled={isSaving || isProtected}
                  onClick={() => toggleStatus(u)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    u.planStatus === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {isSaving ? "Guardando…" : (u.planStatus ?? "active")}
                </button>

                {isMaster && !isSelf && (
                  <div className="flex gap-2">
                    <button
                      disabled={verifyingUid === u.uid}
                      onClick={() => handleVerify(u)}
                      className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {verifyingUid === u.uid ? "Verificando…" : "Verificar"}
                    </button>
                    <button
                      disabled={deletingUid === u.uid}
                      onClick={() => handleDelete(u)}
                      className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingUid === u.uid ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-6">Sin usuarios</p>
        )}
      </div>

      {/* ── DESKTOP: table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr className="border-b">
              <th className="text-left py-2 px-3">Email</th>
              <th className="text-left px-3">Rol</th>
              <th className="text-left px-3">Plan</th>
              <th className="text-left px-3">Estado</th>
              {isMaster && <th className="px-3" />}
            </tr>
          </thead>

          <tbody>
            {users.map(u => {
              const isSelf = u.uid === currentUser?.uid;
              const isProtected = isSelf && (u.role === "master" || u.role === "owner");

              return (
                <tr key={u.uid} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(tú)</span>}
                  </td>
                  <td className="px-3">
                    <select
                      value={u.role}
                      disabled={isProtected || savingUid === u.uid}
                      onChange={e => handleUpdate(u.uid, { role: e.target.value as UserRole })}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {savingUid === u.uid && <span className="ml-2 text-xs text-blue-500">Guardando…</span>}
                    {isProtected && <span className="ml-2 text-xs text-slate-400">(protegida)</span>}
                  </td>
                  <td className="px-3">
                    <select
                      value={u.planKey ?? "estudiante"}
                      disabled={savingUid === u.uid}
                      onChange={e => handleUpdate(u.uid, { planKey: e.target.value })}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3">
                    <button
                      disabled={savingUid === u.uid || isProtected}
                      onClick={() => toggleStatus(u)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        u.planStatus === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {savingUid === u.uid ? "Guardando…" : (u.planStatus ?? "active")}
                    </button>
                  </td>
                  {isMaster && (
                    <td className="px-3 text-right">
                      {!isSelf && (
                        <div className="flex gap-2 justify-end">
                          <button
                            disabled={verifyingUid === u.uid}
                            onClick={() => handleVerify(u)}
                            className="px-3 py-1 rounded text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
                          >
                            {verifyingUid === u.uid ? "Verificando…" : "Verificar"}
                          </button>
                          <button
                            disabled={deletingUid === u.uid}
                            onClick={() => handleDelete(u)}
                            className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            {deletingUid === u.uid ? "Eliminando…" : "Eliminar"}
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">Agregar usuario</h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Contraseña temporal</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Plan</label>
                <select
                  value={form.planKey}
                  onChange={e => setForm(f => ({ ...f, planKey: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={formLoading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {formLoading ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
