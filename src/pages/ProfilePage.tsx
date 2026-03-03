// src/pages/ProfilePage.tsx

import { useEffect, useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { getUser, updateUserProfile } from "@/services/userService";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const auth = getAuth();

  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setPhotoURL(user.photoURL ?? "");
    }
  }, [user]);

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!user) return <div className="p-6">No autenticado.</div>;

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateUserProfile(user.uid, {
        displayName,
        photoURL,
      });
      alert("Perfil actualizado correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user.email) return;
    await sendPasswordResetEmail(auth, user.email);
    alert("Se envió un correo para cambiar tu contraseña.");
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
      <h1 className="text-2xl font-semibold mb-6">Mi Perfil</h1>

      <div className="space-y-6">

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            value={user.email}
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-100"
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Nombre
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Photo URL */}
        <div>
          <label className="block text-sm font-medium mb-1">
            URL Foto (opcional)
          </label>
          <input
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Rol
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded">
            {user.role}
          </div>
        </div>

        {/* Subscription */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Plan
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded">
            {user.subscription} ({user.subscriptionStatus})
          </div>
        </div>

        {/* Password */}
        <div>
          <button
            onClick={handlePasswordReset}
            className="text-blue-600 hover:underline text-sm"
          >
            Cambiar contraseña
          </button>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

      </div>
    </div>
  );
}