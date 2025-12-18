// src/pages/admin/AdminUsersPage.tsx
import { useEffect, useState } from "react";
import { fetchUsers, updateUser } from "@/services/adminUserService";
import type { UserRole } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import type { AdminUser } from "@/services/adminUserService";

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingUid, setSavingUid] = useState<string | null>(null);

    const { user: currentUser } = useAuth();

    useEffect(() => {
        fetchUsers()
            .then(setUsers)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <p>Cargando usuarios…</p>;
    }

    /* ============================================================
    * UPDATE HANDLER (CENTRAL)
    * ============================================================ */

    const handleUpdate = async (
        uid: string,
        data: Partial<{
            role: UserRole;
            planKey: string;
            planStatus: "active" | "inactive";
            isTestAccount: boolean;
        }>
    ) => {
        try {
            setSavingUid(uid);
            await updateUser(uid, data);

            setUsers(prev =>
                prev.map(u => (u.uid === uid ? { ...u, ...data } : u))
            );
        } finally {
            setSavingUid(null);
        }
    };

    const toggleStatus = async (u: AdminUser) => {
        const ok = confirm(
            `¿Seguro que deseas ${
            u.planStatus === "active" ? "desactivar" : "activar"
            } este usuario?`
        );
        if (!ok) return;

        await handleUpdate(u.uid, {
            planStatus: u.planStatus === "active" ? "inactive" : "active",
        });
    };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h1 className="text-2xl font-bold mb-6">Usuarios</h1>

      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr className="border-b">
            <th className="text-left py-2 px-2">Email</th>
            <th className="text-left px-2">Rol</th>
            <th className="text-left px-2">Plan</th>
            <th className="text-left px-2">Estado</th>
          </tr>
        </thead>

        <tbody>
          {users.map(u => (
            <tr key={u.uid} className="border-b">
                {/* EMAIL */}
                <td className="py-2 px-2">{u.email}</td>

                {/* ROL */}

              <td className="px-2">
                <select
                  value={u.role}
                  disabled={u.uid === currentUser?.uid && u.role === "master"}
                  onChange={e =>
                    handleUpdate(u.uid, { 
                        role: e.target.value as UserRole })
                  }
                  className="border rounded px-2 py-1"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === "master" && (
                    <option value="master">Master</option>
                  )}
                </select>

                {/* Guardando */}
                {savingUid === u.uid && (
                    <span className="ml-2 text-xs text-blue-500">
                    Guardando…
                    </span>
                )}

                {/* Cuenta protegida */}
                {u.uid === currentUser?.uid && u.role === "master" && (
                    <span className="ml-2 text-xs text-slate-400">
                    (Cuenta protegida)
                    </span>
                )}
                </td>

                {/* PLAN */}
                <td className="px-2">
                    <select
                        value={u.planKey ?? "free"}
                        onChange={e =>
                        handleUpdate(u.uid, { planKey: e.target.value })
                        }
                        className="border rounded px-2 py-1"
                    >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                    </select>
                </td>
                    
                    {/* ESTADO */}
                    <td className="px-2">
                <button
                  disabled={
                    savingUid === u.uid ||
                    (u.uid === currentUser?.uid && u.role === "master")
                  }
                  onClick={() => toggleStatus(u)}
                  className={`px-3 py-1 rounded text-xs ${
                    u.planStatus === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {savingUid === u.uid ? "Guardando…" : u.planStatus}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}