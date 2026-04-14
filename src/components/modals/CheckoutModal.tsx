// ============================================================================
// src/components/modals/CheckoutModal.tsx
// CONTILISTO — PLAN CHECKOUT MODAL (PRODUCTION READY)
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
  const [errorMsg, setErrorMsg] = useState("");

  const log = (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  };

  const handleContinue = async () => {
    if (loading) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error("Debes iniciar sesión antes de seleccionar un plan.");
      }

      // =========================================================================
      // FREE PLAN — NO STRIPE
      // =========================================================================
      if (planType === "estudiante") {
        log("Free plan -> skipping Stripe");

        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            uid: currentUser.uid,
            email: currentUser.email ?? "",
            plan: {
              type: "estudiante",
              status: "active",
              source: "internal",
            },
            subscriptionStatus: "active",
            billingProvider: "internal",
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        log("✅ Free plan activated:", currentUser.uid);

        onClose();
        navigate("/success?plan=estudiante");
        return;
      }

      // =========================================================================
      // PAID PLANS — STRIPE
      // =========================================================================
      const priceMap: Record<PaidPlan, string> = {
        contador: "price_1TK0iYJ0Edrbdw3kBlDsy4eT",
        corporativo: "price_1TK0iXJ0Edrbdw3kAZOq8thm",
      };

      const priceId = priceMap[planType as PaidPlan];

      if (!priceId) {
        throw new Error("Plan inválido.");
      }

      log("Price ID:", priceId);

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

      let data: any;

      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        log("❌ Non-JSON response:", text);
        throw new Error("Respuesta inválida del servidor.");
      }

      if (!res.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "No se pudo crear la sesión de pago."
        );
      }

      if (!data?.url) {
        throw new Error("Stripe no devolvió una URL de checkout.");
      }

      log("🚀 Redirecting to Stripe...");
      window.location.href = data.url;

    } catch (error: any) {
      log("🔥 Checkout error:", error);
      setErrorMsg(error?.message || "Ocurrió un error al continuar.");
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

        {/* ERROR MESSAGE */}
        {errorMsg && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        {/* COUPON INPUT — ONLY PAID */}
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