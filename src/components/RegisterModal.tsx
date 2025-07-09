// src/components/RegisterModal.tsx
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase-config";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RegisterModal({ isOpen, onClose }: RegisterModalProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccess("Registration successful. You can now log in.");
      setError("");
      setTimeout(() => {
        onClose();
        navigate("/dashboard");
      }, 1000);
    } catch (err: any) {
      setError(err.message);
      setSuccess("");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-semibold mb-4">Register</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-600 mb-2">{success}</p>}
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
      <button
        className="w-full bg-green-600 text-white py-2 rounded"
        onClick={handleRegister}
      >
        Registro
      </button>
    </Modal>
  );
}