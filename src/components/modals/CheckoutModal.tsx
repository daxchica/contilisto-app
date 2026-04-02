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

  const handleContinue = () => {
    console.log("Selected plan:", planType);

    // 👉 NEXT STEP: Stripe Checkout here
    alert(`Continuar con el plan: ${plan.name}`);
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