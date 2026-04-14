// src/components/RegisterModal.tsx
import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/firebase-config";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import Modal from "@/components/ui/Modal";
import { PlanType } from "@/config/plans";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan?: PlanType;
  onRegisterSuccess?: () => void;
}

export default function RegisterModal({ 
  isOpen, 
  onClose,
  selectedPlan,
  onRegisterSuccess,
}: RegisterModalProps) {
  
  // =========================================
  // STATE
  // =========================================
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // ==========================================================================
  // RESET WHEN MODAL CLOSES
  // ==========================================================================
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setTelefono("");
      setPassword("");
      setName("");
      setCompany("");
      setError("");
      setSuccess("");
      setLoading(false);
    }
  }, [isOpen]);

  // ==========================================================================
  // REGISTER HANDLER
  // ==========================================================================
  const handleRegister = async () => {
    if (loading) return;

    if (!name || !email || !password) {
      setError("Completa los campos obligatorios");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
    }

    try {
      setLoading(true);
      setError("");

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      await setDoc(
        doc(db, "users", user.uid), 
        {
          uid: user.uid,
          email: user.email,
          name,
          telefono,
          company: company || null,
          plan: selectedPlan
            ? {
                type: selectedPlan,
                status: "active",
                source: "register",
              }  
            : null,
          subscriptionStatus: selectedPlan ? "active" : "none",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSuccess("Registracion exitosa.");

      onRegisterSuccess?.();
      
    } catch (err: any) {
      setError(err.message || "Error al registrarse");
      setSuccess("");
    } finally {
      setLoading(true);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (!isOpen) return null;
  
  return (
    <Modal title="Crear cuenta" onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4">Crear Cuenta</h2>

      {/* ERROR */}
      {error && <p className="text-red-500 mb-2">{error}</p>}
      
      {/* SUCCESS */}
      {success && <p className="text-green-600 mb-2">{success}</p>}
      
      {/* FORM */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRegister();
        }}
        className="space-y-3"
      >
      <input
        type="text"
        placeholder="Nombre completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-2 border rounded mb-3"
      />

      <input
        type="tel"
        placeholder="Numero de Teléfono"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        className="w-full p-2 border rounded mb-3"
      />

      <input
        type="email"
        placeholder="Email"
        className="w-full p-2 border rounded mb-3"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      
      <input
        type="password"
        placeholder="Password"
        className="w-full p-2 border rounded mb-3"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        type="text"
        placeholder="Empresa (opcional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="w-full p-2 border rounded mb-3"
      />
      
      <button
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? "Registrando..." : "Registro"}
      </button>
      </form>
    </Modal>
  );
}