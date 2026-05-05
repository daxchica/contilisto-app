// ============================================================================
// src/hooks/usePlan.ts (PRODUCTION READY)
// ============================================================================

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase-config";
import { useAuth } from "@/context/AuthContext";
import { PLANS, PlanType } from "@/config/plans";

const VALID_PLANS = new Set<PlanType>(["estudiante", "contador", "corporativo"]);

const SUBSCRIPTION_TO_PLAN: Record<string, PlanType> = {
  Pro: "contador",
  Enterprise: "corporativo",
  Free: "estudiante",
};

function resolvePlan(data: Record<string, any> | undefined): PlanType {
  if (!data) return "estudiante";

  // 1. Master/owner role always gets corporativo
  const role = data?.role;
  if (role === "master" || role === "owner") return "corporativo";

  const flatKey = data?.planKey as string | undefined;
  const flatStatus = data?.planStatus as string | undefined;

  // 2. Admin-set planKey — explicit override, checked before Stripe fields
  //    so the admin panel always wins. Skip only if explicitly inactive.
  if (flatKey && flatKey !== "estudiante" && VALID_PLANS.has(flatKey as PlanType)) {
    if (flatStatus !== "inactive") return flatKey as PlanType;
  }

  // 3. Stripe flow: nested plan.type + subscriptionStatus (paid plans only)
  const nestedType = data?.plan?.type as string | undefined;
  const nestedStatus = data?.subscriptionStatus as string | undefined;
  if (
    nestedStatus === "active" &&
    nestedType &&
    nestedType !== "estudiante" &&
    VALID_PLANS.has(nestedType as PlanType)
  ) {
    return nestedType as PlanType;
  }

  // 4. Legacy subscription field ("Pro", "Enterprise")
  const sub = data?.subscription as string | undefined;
  if (sub && sub !== "Free" && SUBSCRIPTION_TO_PLAN[sub]) {
    return SUBSCRIPTION_TO_PLAN[sub];
  }

  return "estudiante";
}

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
      const data = snap.data();
      setPlanId(resolvePlan(data));
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