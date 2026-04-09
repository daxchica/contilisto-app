// src/hooks/usePlan.ts

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase-config";
import { useAuth } from "@/context/AuthContext";
import { PLANS, PlanType } from "@/config/plans";

export function usePlan() {
  const { user } = useAuth();

  const [planId, setPlanId] = useState<PlanType>("estudiante");
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!user?.uid) return;

    const ref = doc(db, "users", user.uid);
  
  return onSnapshot(ref, (snap) => {
      const data = snap.data();
      setPlanId((data?.plan as PlanType) || "estudiante");
      setLoading(false);
    });
  }, [user?.uid]);

  const plan = PLANS[planId];

  return {
    plan,
    loading,
    isFree: planId === "estudiante",
    isPro: planId === "contador",
    isEnterprise: planId === "corporativo",
  };
}