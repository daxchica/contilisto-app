// src/pages/Register.tsx
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const stripe = await stripePromise;
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const session = await response.json();
    if (session.id) {
      stripe?.redirectToCheckout({ sessionId: session.id });
    } else {
      alert("Error creating Stripe session");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md max-w-md w-full"
      >
        <h2 className="text-2xl font-bold mb-6 text-blue-700">Regístrate en Contilisto</h2>

        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Nombre completo"
          required
          className="mb-4 w-full px-4 py-2 border border-gray-300 rounded"
        />

        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Correo electrónico"
          required
          className="mb-4 w-full px-4 py-2 border border-gray-300 rounded"
        />

        <input
          type="text"
          name="company"
          value={formData.company}
          onChange={handleChange}
          placeholder="Nombre de empresa"
          required
          className="mb-6 w-full px-4 py-2 border border-gray-300 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-700 text-white py-2 rounded hover:bg-blue-600 transition"
        >
          {loading ? "Procesando..." : "Suscribirse por $29/mes"}
        </button>
      </form>
    </div>
  );
}