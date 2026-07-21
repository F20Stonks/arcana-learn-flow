import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Compass, Play, ArrowRight } from "lucide-react";
import { planNextAction, NextActionPlan, TrackLite } from "@/lib/nextAction";

/**
 * "What to do next" — one deterministic recommendation synthesized from due
 * reviews, exam dates, spec coverage, and track progress (see lib/nextAction.ts).
 * The Dashboard already loads tracks + subtopics; this only adds two small
 * queries (reviews + spec tick counts). Fails soft: any error renders nothing.
 */
export default function NextActionCard({ tracks }: { tracks: TrackLite[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  if (!plan) return null;
  const { primary, secondary } = plan;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-1.5 mb-2">
        <Compass className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What to do next</h3>
        {primary.kind === "overdue_review" && (
          <span className="text-[10px] uppercase tracking-wider text-destructive bg-destructive/10 rounded px-1.5 py-0.5 font-semibold">
            Overdue
          </span>
        )}
      </div>

      <p className="text-sm text-foreground mb-4">{primary.reason}</p>

      <button
        onClick={() => navigate(primary.to)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Play className="h-3.5 w-3.5" />
        {primary.cta}
      </button>

      {secondary.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-1.5">
          {secondary.map((s) => (
            <button
              key={s.to}
              onClick={() => navigate(s.to)}
              className="w-full flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors group"
            >
              <span className="flex-1 truncate text-left">{s.reason}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
