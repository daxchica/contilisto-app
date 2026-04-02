import { PLANS, PlanType } from "@/config/plans";
import { useAuth } from "@/context/AuthContext";

export function usePlan() {
  const { user } = useAuth();

  const planType = (user?.plan || "estudiante") as PlanType;

  const plan = PLANS[planType];

  return {
    planType,
    plan,
  };
}