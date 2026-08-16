import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, CheckCircle2, CircleDashed } from "lucide-react";

export interface PaperRow {
  competition: string;
  year: number;
  question_count: number;
  solved: number;
  attempted: number;
  with_solutions: number;
  with_diagram: number;
}

interface PapersViewProps {
  userId: string | undefined;
  onOpenPaper: (competition: string, year: number) => void;
}

/**
 * Papers, not a 2,037-row list.
 *
 * "STEP II 2013" is a thing a student actually sits — it is the unit they think in, revise against and
 * time themselves on. The flat list had no concept of it: every question was a peer of every other, so
 * the only way to work a paper was to filter twice and hope the ordering held. 178 papers on a shelf is
 * navigable; 2,037 undifferentiated rows is a dump.
 *
 * Progress lives on the paper tile because that is the unit worth finishing. Per-question ticks in a
 * flat list never add up to a sense of completion.
 */
export default function PapersView({ userId, onOpenPaper }: PapersViewProps) {
  const [papers, setPapers] = useState<PaperRow[] | null>(null);
  const [openComp, setOpenComp] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("reference_question_papers" as never, {
        p_user_id: userId ?? null,
      } as never);
      if (cancelled) return;
      if (error) console.error("Couldn't load papers:", error);
      setPapers((data as PaperRow[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Group by competition, preserving the RPC's year-descending order within each.
  const groups = useMemo(() => {
    const map = new Map<string, PaperRow[]>();
    for (const p of papers ?? []) {
      const list = map.get(p.competition) ?? [];
      list.push(p);
      map.set(p.competition, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [papers]);

  if (!papers) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="mb-3 h-5 w-40" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-20" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(([competition, rows]) => {
        // Collapsed by default past a threshold: Putnam alone is 41 years, and four such runs open at
        // once is the same wall of undifferentiated tiles this view exists to replace.
        const expanded = openComp === competition;
        const visible = expanded ? rows : rows.slice(0, 12);
        const totalQ = rows.reduce((a, r) => a + r.question_count, 0);
        const totalSolved = rows.reduce((a, r) => a + r.solved, 0);

        return (
          <section key={competition}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-foreground">
                {competition}
                <span className="ml-2 text-[13px] font-normal text-muted-foreground">
                  {rows.length} papers · {totalQ} questions
                  {totalSolved > 0 && ` · ${totalSolved} solved`}
                </span>
              </h2>
              {rows.length > 12 && (
                <button
                  onClick={() => setOpenComp(expanded ? null : competition)}
                  className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {expanded ? "Show less" : `Show all ${rows.length}`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {visible.map((p) => {
                const pct = p.question_count ? Math.round((p.solved / p.question_count) * 100) : 0;
                const done = p.solved === p.question_count && p.question_count > 0;
                return (
                  <button
                    key={`${p.competition}-${p.year}`}
                    onClick={() => onOpenPaper(p.competition, p.year)}
                    className="group rounded-xl border border-border bg-accent/15 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="readout text-[15px] font-semibold text-foreground">{p.year}</span>
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : p.attempted + p.solved > 0 ? (
                        <CircleDashed className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {p.question_count} question{p.question_count === 1 ? "" : "s"}
                    </div>
                    {/* Only drawn once there is progress: an empty bar on all 178 tiles is noise that
                        says nothing, and makes an untouched shelf look like a failure state. */}
                    {p.solved + p.attempted > 0 && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
