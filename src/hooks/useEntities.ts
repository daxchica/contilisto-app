// src/hooks/useEntities.ts
import { useEffect, useState } from "react";
import { fetchEntities } from "@/services/entityService";
import { useAuth } from "@/context/AuthContext";

export function useEntities() {
  const { user } = useAuth();  
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const load = async () => {
      setLoading(true);
      const data = await fetchEntities(user.uid);
      setEntities(data || []);
      setLoading(false);
    };

    load();
  }, [user]);

  return {
    entities,
    loading
  };
}