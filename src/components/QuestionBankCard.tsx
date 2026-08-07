/**
 * Dashboard entry point into the question bank (/question-bank) — spans every ingested competition
 * (STEP, Putnam, IMO, …), not just STEP.
 *
 * Self-contained (fetches its own count) so Dashboard's track-loading path stays untouched — if the
 * corpus query fails the card still renders, just without the count, rather than taking the dashboard
 * down with it.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function QuestionBankCard({ delay = 0 }: { delay?: number }) {
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count: n, error } = await (supabase.from("reference_questions" as never) as any).select("id", {
        count: "exact",
        head: true,
      });
      if (!cancelled && !error && typeof n === "number") setCount(n);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <button
      onClick={() => navigate("/question-bank")}
      className="glass-card glass-card-hover reveal group flex w-full items-center gap-4 rounded-2xl p-5 text-left"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-accent/40 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
        <Library className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">Question bank</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">
          {count !== null ? `${count.toLocaleString()} real ` : "Real "}
          questions from STEP, Putnam, the IMO and more — browse by competition and topic.
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </button>
  );
}
