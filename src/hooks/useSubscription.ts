import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPaddleEnvironment } from "@/lib/paddle";

export type Tier = "free" | "pro" | "ultra";

export interface SubscriptionState {
  tier: Tier;
  status: string | null;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  priceId: string | null;
  productId: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

function deriveTier(productId: string | null): Tier {
  if (productId === "ultra_plan") return "ultra";
  if (productId === "pro_plan") return "pro";
  return "free";
}

export function useSubscription(): SubscriptionState {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!userId) {
      setRow(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("environment", getPaddleEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRow(data ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSub();
  }, [fetchSub]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`subs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => { fetchSub(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchSub]);

  const status = row?.status ?? null;
  const end = row?.current_period_end ? new Date(row.current_period_end) : null;
  const withinPeriod = !end || end > new Date();
  const isActive =
    !!row && (
      (["active", "trialing", "past_due"].includes(status) && withinPeriod) ||
      (status === "canceled" && !!end && end > new Date())
    );

  return {
    tier: isActive ? deriveTier(row?.product_id ?? null) : "free",
    status,
    isActive: !!isActive,
    cancelAtPeriodEnd: !!row?.cancel_at_period_end,
    currentPeriodEnd: row?.current_period_end ?? null,
    priceId: row?.price_id ?? null,
    productId: row?.product_id ?? null,
    loading,
    refetch: fetchSub,
  };
}
