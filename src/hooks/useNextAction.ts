import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { planNextAction, NextActionPlan, TrackLite } from "@/lib/nextAction";

/**
 * The Dashboard's single "what to do next" recommendation. Extracted from NextActionCard so
 * UpNextCard can drive off the same real plan instead of a second, independent computation —
 * the two are alternate renderings of one answer, not two answers.
 */
export function useNextAction(tracks: TrackLite[]): NextActionPlan | null {
  const { user } = useAuth();
  const [plan, setPlan] = useState<NextActionPlan | null>(null);

  useEffect(() => {
    if (!user || tracks.length === 0) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const trackIds = tracks.map((t) => t.id);
        const [revRes, specRes] = await Promise.all([
          supabase.from("subtopic_reviews").select("subtopic_id, next_review_due_at").eq("user_id", user.id),
          supabase.from("spec_checklist_items").select("track_id, ticked").in("track_id", trackIds),
        ]);

        const reviews = (revRes.data || []).map((r) => ({
          subtopicId: r.subtopic_id,
          dueAt: r.next_review_due_at,
        }));

        const spec = new Map<string, { ticked: number; total: number }>();
        for (const item of specRes.data || []) {
          const cur = spec.get(item.track_id) || { ticked: 0, total: 0 };
          cur.total += 1;
          if (item.ticked) cur.ticked += 1;
          spec.set(item.track_id, cur);
        }
        const enriched = tracks.map((t) => ({
          ...t,
          specTicked: spec.get(t.id)?.ticked,
          specTotal: spec.get(t.id)?.total,
        }));

        if (!cancelled) setPlan(planNextAction({ now: new Date(), tracks: enriched, reviews }));
      } catch (e) {
        console.error("Next-action recommendation failed:", e);
        if (!cancelled) setPlan(null); // fail soft — never break the Dashboard
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, tracks]);

  return plan;
}
