// ============================================================================
// src/hooks/usePlan.ts (PRODUCTION READY)
// ============================================================================

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase-config";
import { useAuth } from "@/context/AuthContext";
import { PLANS, PlanType } from "@/config/plans";

type UserPlanData = {
  plan?: {
    type?: PlanType;
    status?: "active" | "inactive" | "canceled";
  };
  subscriptionStatus?: "active" | "inactive" | "canceled";
};

export function usePlan() {
  const { user } = useAuth();

  const [planId, setPlanId] = useState<PlanType>("estudiante");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data() as UserPlanData | undefined;

      // 🔥 SAFE DEFAULTS
      let resolvedPlan: PlanType = "estudiante";

      // ✅ Only trust ACTIVE subscriptions
      if (
        data?.subscriptionStatus === "active" &&
        data?.plan?.type
      ) {
        resolvedPlan = data.plan.type;
      }

      setPlanId(resolvedPlan);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const plan = PLANS[planId];

  return {
    plan,
    planId,
    loading,

    // 🔥 SAFER FLAGS
    isFree: planId === "estudiante",
    isPro: planId === "contador",
    isEnterprise: planId === "corporativo",

    // 🔥 EXTRA (useful for UI)
    isPaid: planId !== "estudiante",
  };
}