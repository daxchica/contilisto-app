// ============================================================================
// src/components/modals/CheckoutModal.tsx
// CONTILISTO — PLAN CHECKOUT MODAL
// - Free plan bypasses Stripe
// - Paid plans use Stripe Checkout
// - Uses authenticated Firebase user
// ============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlanType, PLANS } from "@/config/plans";
import { auth, db } from "@/firebase-config";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

type Props = {
  planType: PlanType;
  onClose: () => void;
};

type PaidPlan = Exclude<PlanType, "estudiante">;

export default function CheckoutModal({ planType, onClose }: Props) {
  const plan = PLANS[planType];
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState("");

  const handleContinue = async () => {
    if (loading) return;

    setLoading(true);
    console.log("Continue clicked");
    console.log("Selected plan:", planType);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error("Debes iniciar sesión antes de seleccionar un plan.");
      }

      // =========================================================================
      // FREE PLAN — DO NOT USE STRIPE
      // =========================================================================
      if (planType === "estudiante") {
        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            uid: currentUser.uid,
            email: currentUser.email ?? "",
            plan: "estudiante",
            subscriptionStatus: "active",
            billingProvider: "internal",
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        console.log("✅ Free plan activated for:", currentUser.uid);

        onClose();
        navigate("/success?plan=estudiante");
        return;
      }

      // =========================================================================
      // PAID PLANS — USE STRIPE
      // =========================================================================
      const priceMap: Record<PaidPlan, string> = {
        contador: "price_1TK0iYJ0Edrbdw3kBlDsy4eT",
        corporativo: "price_1TK0iXJ0Edrbdw3kAZOq8thm",
      };

      const priceId = priceMap[planType as PaidPlan];
      console.log("Price ID:", priceId);

      const res = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId,
          userId: currentUser.uid,
          email: currentUser.email ?? "",
          product: "contilisto",
          planType,
          coupon: coupon.trim() || undefined,
        }),
      });

      console.log("📡 Fetch response:", res);

      let data: any;

      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        console.error("❌ Non-JSON response:", text);
        throw new Error("Respuesta inválida del servidor.");
      }

      console.log("✅ Response data:", data);

      if (!res.ok) {
        throw new Error(
          data?.message || data?.error || "No se pudo crear la sesión de pago."
        );
      }

      if (data.url) {
        console.log("🚀 Redirecting to Stripe...");
        window.location.href = data.url;
      } else {
        console.error("❌ No URL returned", data);
        throw new Error("Stripe no devolvió una URL de checkout.");
      }
    } catch (error: any) {
      console.error("🔥 Checkout error:", error);
      alert(error?.message || "Ocurrió un error al continuar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 w-[90%] max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Confirmar Plan
        </h2>

        <p className="text-gray-600 mb-6">
          Estás seleccionando el plan:
        </p>

        {/* PLAN INFO */}
        <div className="bg-gray-100 rounded-xl p-4 mb-6 text-center">
          <p className="text-lg font-semibold">{plan.name}</p>
          <p className="text-3xl font-bold mt-2">${plan.price}/mes</p>
        </div>

        {/* COUPON INPUT — ONLY FOR PAID PLANS */}
        {planType !== "estudiante" && (
          <input
            type="text"
            placeholder="Código de descuento"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 mb-4"
          />
        )}

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border rounded-lg py-2 hover:bg-gray-100 disabled:opacity-50"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            onClick={handleContinue}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading
              ? "Procesando..."
              : planType === "estudiante"
              ? "Activar gratis"
              : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}