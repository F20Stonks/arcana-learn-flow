/**
 * The problem database.
 *
 * Training is a queue that moves you forward one problem at a time. This is the opposite: every
 * problem in the bank, sitting still, searchable — for when you remember an integral you've seen
 * before (or want to work one competition's set as it originally appeared) and want to find it
 * again rather than grind toward it.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import Tex from "@/features/integrals/components/Tex";
import SolutionSteps from "@/features/integrals/components/SolutionSteps";
import { useProgress } from "@/features/integrals/hooks/useProgress";
import { hasSolved, setManuallySolved } from "@/features/integrals/progress";
import { TECHNIQUES, TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import { DIFFICULTY_LABEL, PROBLEMS, SOURCES, formatSource, sourceKey } from "@/features/integrals/problems";
import { integralLatex } from "@/features/integrals/latex";
import type { TechniqueId } from "@/features/integrals/types";

type SolvedFilter = "all" | "solved" | "unsolved";

export default function IntegralDatabase() {
  const progress = useProgress();
  const [query, setQuery] = useState("");
  const [technique, setTechnique] = useState<TechniqueId | "">("");
  const [source, setSource] = useState("");
  const [solvedFilter, setSolvedFilter] = useState<SolvedFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (technique && !p.techniques.includes(technique)) return false;
      if (source && sourceKey(p.source) !== source) return false;
      const solved = hasSolved(progress, p.id);
      if (solvedFilter === "solved" && !solved) return false;
      if (solvedFilter === "unsolved" && solved) return false;
      if (!q) return true;
      const haystack = `${p.integrand} ${p.integrandExpr} ${p.answer} ${p.answerLatex} ${p.id}`.toLowerCase();
      return haystack.includes(q);
    }).sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
  }, [query, technique, source, solvedFilter, progress]);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <Link
          to="/integrals"
          className="reveal mb-6 inline-flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integral Arena
        </Link>

        <header className="reveal mb-6">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[32px]">
            Problem database
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Every problem in the bank, searchable. Remember an integral? Look it up here instead of
            grinding through the queue to find it again.
          </p>
        </header>

        <div className="reveal rounded-2xl border border-border bg-card p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by integrand, answer, or id…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-[14px] text-foreground"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={technique}
              onChange={(e) => setTechnique(e.target.value as TechniqueId | "")}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground"
            >
              <option value="">Every technique</option>
              {TECHNIQUES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground"
            >
              <option value="">Every source</option>
              {SOURCES.map((s) => (
                <option key={sourceKey(s)} value={sourceKey(s)}>
                  {formatSource(s)}
                </option>
              ))}
            </select>

            <select
              value={solvedFilter}
              onChange={(e) => setSolvedFilter(e.target.value as SolvedFilter)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-foreground"
            >
              <option value="all">Solved or not</option>
              <option value="solved">Solved</option>
              <option value="unsolved">Unsolved</option>
            </select>
          </div>
        </div>

        <p className="reveal mt-4 text-[13px] text-muted-foreground">
          {results.length} problem{results.length === 1 ? "" : "s"}
        </p>

        <ul className="reveal mt-3 flex flex-col gap-2.5">
          {results.map((p) => {
            const open = openId === p.id;
            const solved = hasSolved(progress, p.id);
            return (
              <li key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : p.id)}
                  aria-expanded={open}
                  aria-controls={`problem-${p.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1 overflow-x-auto">
                    <Tex className="text-foreground">{integralLatex(p)}</Tex>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-[12px] text-muted-foreground">
                    {solved && (
                      <span className="flex items-center gap-1 text-primary">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="hidden sm:inline">{DIFFICULTY_LABEL[p.difficulty]}</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">{formatSource(p.source)}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>

                {open && (
                  <div id={`problem-${p.id}`} className="border-t border-border px-4 py-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                      <span>{DIFFICULTY_LABEL[p.difficulty]}</span>
                      <span>·</span>
                      <span>{formatSource(p.source)}</span>
                      {p.techniques.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {TECHNIQUE_BY_ID[t]?.name ?? t}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setManuallySolved(p.id, !solved)}
                      aria-pressed={solved}
                      className={`mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        solved
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {solved ? "Completed" : "Mark as complete"}
                    </button>
                    <SolutionSteps problem={p} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </AppShell>
  );
}
