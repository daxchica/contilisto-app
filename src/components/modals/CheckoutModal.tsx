// ============================================================================
// src/components/modals/CheckoutModal.tsx
// ============================================================================
import { PlanType, PLANS } from "@/config/plans";



type Props = {
  planType: PlanType;
  onClose: () => void;
};

export default function CheckoutModal({ planType, onClose }: Props) {
  const plan = PLANS[planType];

  const handleContinue = async () => {
    console.log("Continue clicked");
    console.log("Selected plan:", planType);

    try {
      const priceMap = {
        estudiante: "price_1TK0iZJ0Edrbdw3kyhIZCS1M",
        contador: "price_1TK0iYJ0Edrbdw3kBlDsy4eT",
        corporativo: "price_1TK0iXJ0Edrbdw3kAZOq8thm" // get this from Stripe
      };

      const priceId = priceMap[planType];

      console.log("Price ID:", priceId);

      const res = await fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({
        priceId,
        userId: "test_user_123", // later replace with auth user
        product: "contilisto",
      }),
    });

    console.log("📡 Fetch response:", res);

    let data;

    try {
      data = await res.json();
    } catch (e) {
      const text = await res.text();
      console.error("❌ Non-JSON response:", text);
      throw new Error("Invalid server response");
    }

    console.log("✅ Response data:", data);

    if (data.url) {
      console.log("🚀 Redirecting to Stripe...");
      window.location.href = data.url;
    } else {
      console.error("❌ No URL returned", data);
    }
  } catch (error) {
    console.error("🔥 Checkout error:", error);
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

        {/* COUPON INPUT (READY FOR NEXT STEP) */}
        <input
          type="text"
          placeholder="Código de descuento"
          className="w-full border rounded-lg px-4 py-2 mb-4"
        />

        {/* ACTIONS */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border rounded-lg py-2 hover:bg-gray-100"
          >
            Cancelar
          </button>

          <button
            onClick={handleContinue}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}