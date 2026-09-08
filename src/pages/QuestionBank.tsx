/**
 * Question bank — the student-facing browser over the ingested `reference_questions` corpus, spanning
 * every source competition (STEP, Putnam, IMO, …).
 *
 * Distinct from QuestionAttack (AI-generated questions against a user's own track): every question here is
 * a real, verbatim past-paper/competition question, so nothing on this surface is generated or auto-graded.
 *
 * Data access goes entirely through the `reference-questions` edge function, NOT direct table queries — the
 * function does server-side filtering/aggregation and rate limits per user, weighting full-question-text
 * ("detail") requests heavier than list/facet ones.
 *
 * Three things worth knowing before editing:
 *
 *  - BROWSING USES THE CANONICAL TAXONOMY, NOT THE SOURCE'S TAGS. `topic_tags` is each source's own
 *    free-text vocabulary; measured on the live corpus it had 366 distinct tags, 218 of them used exactly
 *    once, and asking for the "Pure Mathematics" area returned 195 filter chips in a single row. Filters now
 *    walk area -> strand -> topic out of `reference_topic_aliases` (see
 *    supabase/migrations/20260815120000_question_taxonomy.sql), which caps a topic row at 9 chips and does
 *    not grow as more questions are seeded. Raw tags are still shown on a question as provenance — that is
 *    the only place they belong now.
 *
 *  - AREA COMES FROM THE TOPIC, NOT FROM tag[0]. STEP tags by the paper SECTION a question was printed in,
 *    and papers mix, so 82 questions were filed under the wrong subject. The old Area row also listed
 *    "Putnam" and "IMO" as peers of "Pure Mathematics", because those rows put the competition name in
 *    tag[0]. Questions the taxonomy cannot place surface honestly under `Unclassified` rather than being
 *    hidden — today that is the Putnam/IMO rows, which carry no per-problem topic tags yet.
 *
 *  - PROGRESS IS SELF-DECLARED. The corpus has no solutions (zero rows have `solution_text`) and these are
 *    long-form proof questions, so there is nothing to grade against. The status control records what the
 *    student says, and the copy says so. Writes go to `user_question_attempts`, which is an attempt LOG
 *    (`user_resource_analytics` counts its rows), so completion counts DISTINCT questions, not attempts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import PapersView from "@/components/questionbank/PapersView";
import ReferenceQuestionText from "@/components/ReferenceQuestionText";

type Status = "unseen" | "attempted" | "solved";

interface QuestionSummary {
  id: string;
  source_competition: string;
  year: number | null;
  question_number: string | null;
  topic_tags: string[];
  has_diagram: boolean;
  difficulty: string | null;
  area: string | null;
  strands: string[] | null;
  topics: string[] | null;
  index_only: boolean;
  attempts: number;
  solved: boolean;
}

interface QuestionFull {
  id: string;
  source_competition: string;
  year: number | null;
  question_number: string | null;
  subject: string;
  difficulty: string | null;
  topic_tags: string[];
  question_text: string;
  solution_text: string | null;
  has_diagram: boolean;
  storage_path: string | null;
  source_url: string;
  license_note: string | null;
}

interface Classification {
  area: string | null;
  strands: string[] | null;
  topics: string[] | null;
}

interface Facets {
  competitions: [string, number][];
  areas: [string, number][];
  strands: [string, number][];
  topics: [string, number][];
  years: number[];
}

interface Progress {
  total: number;
  attempted: number;
  solved: number;
  byCompetition: { competition: string; total: number; attempted: number; solved: number }[];
  byArea: { area: string; total: number; attempted: number; solved: number }[];
}

const EMPTY_FACETS: Facets = { competitions: [], areas: [], strands: [], topics: [], years: [] };

// The taxonomy's sentinel for "could not be classified" (see the migration). Given a friendlier face here
// rather than in the database, so the stored value stays a plain, greppable marker.
const UNCLASSIFIED = "Unclassified";
const areaLabel = (a: string) => (a === UNCLASSIFIED ? "Not yet classified" : a);

const label = (q: { source_competition: string; year: number | null; question_number: string | null }) =>
  `${q.source_competition}${q.year ? ` ${q.year}` : ""}${q.question_number ? ` · Q${q.question_number}` : ""}`;

// A question with no reproducible text links out instead of pretending to render. This is a CONTENT test:
// the previous version keyed off `license_note` containing "not reproduced here", which matched 24 IMO rows
// whose text is in fact fully present — hiding real questions behind a link — and matched none of Putnam's
// 492 rows. `index_only` from the list RPC applies the same content test server-side.
const hasNoText = (text: string | null | undefined) =>
  !text || text.trim().length < 40 || text.includes("not reproduced");

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "unseen", label: "Not started" },
  { value: "attempted", label: "Attempting" },
  { value: "solved", label: "Solved" },
];

const RATE_LIMIT_MESSAGE = "Slow down a little — you've hit the read limit. Try again in a few minutes.";

async function callBank<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const resp = await supabase.functions.invoke("reference-questions", { body });
  if (resp.error) {
    // supabase-js surfaces a non-2xx as resp.error without the parsed body in some versions.
    const status = (resp.error as { context?: { status?: number } })?.context?.status;
    if (status === 429) return { data: null, error: RATE_LIMIT_MESSAGE };
    return { data: null, error: resp.error.message || "Request failed." };
  }
  return { data: resp.data as T, error: null };
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-primary/50 bg-primary/12 text-primary"
          : "border-border bg-accent/30 text-muted-foreground hover:border-border hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-accent/60 px-2.5 py-1 text-[11px] text-muted-foreground">{children}</span>;
}

function Count({ n }: { n: number }) {
  return <span className="readout ml-1 text-[11px] opacity-60">{n}</span>;
}

/** A filter row that only renders when it has options — keeps the stack from reserving empty space. */
function FilterRow({
  title,
  options,
  value,
  allLabel,
  onPick,
  boxed,
}: {
  title: string;
  options: [string, number][];
  value: string;
  allLabel: string;
  onPick: (v: string) => void;
  boxed?: boolean;
}) {
  if (options.length === 0) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        boxed ? "rounded-xl border border-border bg-accent/15 p-3" : ""
      }`}
    >
      <span className="micro-label mr-1">{title}</span>
      <Chip active={!value} onClick={() => onPick("")}>
        {allLabel}
      </Chip>
      {options.map(([name, n]) => (
        <Chip key={name} active={value === name} onClick={() => onPick(value === name ? "" : name)}>
          {areaLabel(name)}
          <Count n={n} />
        </Chip>
      ))}
    </div>
  );
}

/** Thin two-tone bar: solved fills from the left, attempted-but-unsolved shades the next slice. */
function ProgressBar({ total, attempted, solved }: { total: number; attempted: number; solved: number }) {
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/50">
      <div className="flex h-full">
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct(solved)}%` }} />
        <div
          className="h-full bg-primary/30 transition-[width] duration-500"
          style={{ width: `${pct(Math.max(0, attempted - solved))}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────── browse list ─────────────────────────── */

export default function QuestionBank() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  // App.tsx gates this route behind BetaGate on profile.waitlist_status === "approved", so every
  // account that reaches this component already has a real /dashboard to go back to.
  const backHome = "/dashboard";

  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Filters live in the URL so a filtered view is shareable and survives the back button out of a question.
  // `view` is one of them: which lens you were using is part of what you'd share or come back to.
  //
  // PAPERS IS THE DEFAULT. The topic lens answers "drill this technique"; the paper lens answers "work a
  // real paper end to end", which is what a student sitting STEP actually does — and it is the one the
  // flat list made impossible.
  const view = params.get("view") === "topics" ? "topics" : "papers";
  const competition = params.get("competition") || "";
  const selectedArea = params.get("area") || "";
  const strand = params.get("strand") || "";
  const topic = params.get("topic") || "";
  const year = params.get("year") || "";
  const status = params.get("status") || "";
  const query = params.get("q") || "";

  // The search box updates the URL on every keystroke for a responsive feel, but the network call is
  // debounced off a separate value — otherwise every keystroke is a billed request.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Each level invalidates the ones below it: a different area can't keep the old strand, and a different
    // strand can't keep the old topic.
    if (key === "area") {
      next.delete("strand");
      next.delete("topic");
    }
    if (key === "strand") next.delete("topic");
    setParams(next, { replace: true });
  };

  const filterBody = useMemo(
    () => ({
      competition: competition || undefined,
      area: selectedArea || undefined,
      strand: strand || undefined,
      topic: topic || undefined,
      year: year ? Number(year) : undefined,
      search: debouncedQuery || undefined,
      status: status || undefined,
    }),
    [competition, selectedArea, strand, topic, year, debouncedQuery, status],
  );

  // Facets depend only on competition/area/strand (see reference_question_facets' signature).
  useEffect(() => {
    (async () => {
      const { data, error } = await callBank<{ facets: Facets }>({
        mode: "facets",
        competition: competition || undefined,
        area: selectedArea || undefined,
        strand: strand || undefined,
      });
      if (data) setFacets({ ...EMPTY_FACETS, ...data.facets });
      else if (error) console.error("Facet load failed:", error);
    })();
  }, [competition, selectedArea, strand]);

  // Progress is whole-bank, so it doesn't refetch on filter changes — only after a status write.
  const loadProgress = useCallback(async () => {
    const { data, error } = await callBank<{ progress: Progress }>({ mode: "progress" });
    if (data) setProgress(data.progress);
    else if (error) console.error("Progress load failed:", error);
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError("");
      const { data, error } = await callBank<{
        questions: QuestionSummary[];
        totalCount: number;
        nextCursor: number | null;
      }>({ mode: "list", filters: filterBody, cursor: 0 });
      if (data) {
        setQuestions(data.questions);
        setTotalCount(data.totalCount);
        setCursor(data.nextCursor);
      } else {
        console.error("Question bank load failed:", error);
        setLoadError(error || "Couldn't load the question bank. Check your connection and try again.");
      }
      setLoading(false);
    })();
  }, [filterBody]);

  const loadMore = async () => {
    if (cursor === null) return;
    setLoadingMore(true);
    const { data, error } = await callBank<{
      questions: QuestionSummary[];
      totalCount: number;
      nextCursor: number | null;
    }>({ mode: "list", filters: filterBody, cursor });
    if (data) {
      setQuestions((prev) => [...prev, ...data.questions]);
      setCursor(data.nextCursor);
    } else {
      console.error("Question bank load-more failed:", error);
    }
    setLoadingMore(false);
  };

  const hasFilters = !!(competition || selectedArea || strand || topic || year || status || query);
  // Strands/topics are meaningless for the Unclassified bucket — those rows have no taxonomy placement.
  const canDrillDown = !!selectedArea && selectedArea !== UNCLASSIFIED;

  return (
    <AppShell>
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 65%)",
        }}
      />

      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <button
          onClick={() => navigate(backHome)}
          className="reveal mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </button>

        <header className="reveal" style={{ animationDelay: "60ms" }}>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[32px]">
            Question <span className="font-serif-accent font-normal text-foreground/80">bank</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
            Real questions from STEP, Putnam, the IMO and more. Browse by topic, then read one properly and
            mark how you got on.
          </p>
        </header>

        {/* Completion. Deliberately the first thing under the title: the bank is big enough that "where am I
            in this" is the question a returning student actually has. */}
        {progress && progress.total > 0 && (
          <section className="reveal glass-card mt-7 rounded-2xl p-5" style={{ animationDelay: "100ms" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="micro-label">Your progress</span>
              <span className="text-[13px] text-muted-foreground">
                <span className="readout text-foreground">{progress.solved}</span> solved
                {progress.attempted > progress.solved && (
                  <>
                    {" · "}
                    <span className="readout text-foreground">{progress.attempted - progress.solved}</span> in
                    progress
                  </>
                )}
                {" · "}
                <span className="readout">{progress.total}</span> in the bank
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar total={progress.total} attempted={progress.attempted} solved={progress.solved} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {progress.byCompetition.map((c) => (
                <button
                  key={c.competition}
                  onClick={() => setFilter("competition", competition === c.competition ? "" : c.competition)}
                  className="rounded-xl border border-border bg-accent/15 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">{c.competition}</span>
                    <span className="readout shrink-0 text-[11px] text-muted-foreground">
                      {c.solved}/{c.total}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar total={c.total} attempted={c.attempted} solved={c.solved} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Lens switch. Both views read the SAME filter state in the URL, so picking a paper here and
            then switching to Topics keeps you inside that paper rather than resetting you to everything. */}
        <div className="reveal mt-8 flex items-center gap-1 rounded-full border border-border bg-accent/15 p-1 w-fit" style={{ animationDelay: "120ms" }}>
          {(["papers", "topics"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter("view", v === "papers" ? "" : v)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "papers" ? "Papers" : "Topics"}
            </button>
          ))}
        </div>

        {view === "papers" && !(competition && year) ? (
          <section className="reveal mt-6" style={{ animationDelay: "160ms" }}>
            <PapersView
              userId={profile?.user_id}
              onOpenPaper={(comp, yr) => {
                // Opening a paper drops into the list view already filtered to it — the paper IS the
                // filter, so there is nothing further for the student to set.
                const next = new URLSearchParams(params);
                next.set("competition", comp);
                next.set("year", String(yr));
                next.set("view", "topics");
                setParams(next, { replace: false });
              }}
            />
          </section>
        ) : (
        <>
        {/* Filters */}
        <section className="reveal mt-8 space-y-4" style={{ animationDelay: "140ms" }}>
          <FilterRow
            title="Competition"
            options={facets.competitions}
            value={competition}
            allLabel="All"
            onPick={(v) => setFilter("competition", v)}
          />
          <FilterRow
            title="Area"
            options={facets.areas}
            value={selectedArea}
            allLabel="All"
            onPick={(v) => setFilter("area", v)}
          />
          {canDrillDown && (
            <FilterRow
              title="Strand"
              options={facets.strands}
              value={strand}
              allLabel={`All of ${selectedArea}`}
              onPick={(v) => setFilter("strand", v)}
              boxed
            />
          )}
          {/* Topics are only offered once a strand is chosen. Showing every topic in an area put 42 chips on
              screen at once; per strand the worst case is 9. */}
          {canDrillDown && strand && (
            <FilterRow
              title="Topic"
              options={facets.topics}
              value={topic}
              allLabel={`All of ${strand}`}
              onPick={(v) => setFilter("topic", v)}
              boxed
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setFilter("q", e.target.value)}
                placeholder="Search questions — e.g. Jensen, projectile, Poisson"
                className="h-10 w-full rounded-full border border-border bg-accent/25 pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none"
              />
            </div>
            <select
              value={year}
              onChange={(e) => setFilter("year", e.target.value)}
              className="h-10 rounded-full border border-border bg-accent/25 px-4 text-[14px] text-foreground focus:border-primary/40 focus:outline-none"
            >
              <option value="">All years</option>
              {facets.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="micro-label mr-1">Progress</span>
            {STATUS_FILTERS.map((s) => (
              <Chip key={s.value} active={status === s.value} onClick={() => setFilter("status", s.value)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </section>

        {/* Results */}
        <section className="mt-8">
          {loading ? (
            <div className="flex items-center gap-3 py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-[14px] text-muted-foreground">Loading the archive…</p>
            </div>
          ) : loadError ? (
            <div className="glass-card rounded-2xl p-5">
              <p className="text-[14px] text-foreground">{loadError}</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-baseline justify-between">
                <span className="readout text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {totalCount} question{totalCount === 1 ? "" : "s"}
                </span>
                {selectedArea === UNCLASSIFIED && (
                  <span className="text-[12px] text-muted-foreground">
                    No topic tags from the source yet — browse by competition and year.
                  </span>
                )}
              </div>

              {questions.length === 0 ? (
                <div className="glass-card rounded-2xl p-10 text-center">
                  <p className="text-[14px] text-muted-foreground">Nothing matches those filters.</p>
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {questions.map((q) => (
                    <Link
                      key={q.id}
                      to={`/question-bank/${q.id}`}
                      state={{ from: location.search }}
                      className="group flex items-center gap-4 bg-accent/10 px-5 py-4 transition-colors hover:bg-accent/30"
                    >
                      {/* Status gutter — a fixed-width column so the labels below it always align, whether or
                          not a given row has an icon. */}
                      <div className="flex w-4 shrink-0 justify-center" aria-hidden>
                        {q.solved ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : q.attempts > 0 ? (
                          <CircleDashed className="h-4 w-4 text-primary/60" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="readout text-[13px] font-medium text-foreground">{label(q)}</span>
                          {q.solved && (
                            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-primary">
                              solved
                            </span>
                          )}
                          {!q.solved && q.attempts > 0 && (
                            <span className="rounded-full bg-accent/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              attempting
                            </span>
                          )}
                          {q.difficulty && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              {q.difficulty}
                            </span>
                          )}
                          {q.has_diagram && (
                            <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-primary">
                              diagram
                            </span>
                          )}
                          {q.index_only && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              link only
                            </span>
                          )}
                        </div>
                        {/* Canonical topics, not raw source tags — the taxonomy is what the filters use, so
                            the row should show the same vocabulary you filtered with. */}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {q.area && <Tag>{areaLabel(q.area)}</Tag>}
                          {(q.topics || []).slice(0, 3).map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </Link>
                  ))}
                </div>
              )}

              {cursor !== null && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Show {Math.min(60, totalCount - questions.length)} more
                </button>
              )}
            </>
          )}
        </section>
        </>
        )}
      </main>
    </AppShell>
  );
}

/* ─────────────────────────── single question ─────────────────────────── */

const STATUS_CHOICES: { value: Status; label: string }[] = [
  { value: "unseen", label: "Not started" },
  { value: "attempted", label: "Attempting" },
  { value: "solved", label: "Solved" },
];

export function QuestionBankDetail() {
  const { questionId } = useParams();
  const location = useLocation();
  const backTo = `/question-bank${(location.state as { from?: string } | null)?.from || ""}`;

  const [question, setQuestion] = useState<QuestionFull | null>(null);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [status, setStatus] = useState<Status>("unseen");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!questionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setLoadError("");
      setImageUrl(null);
      const { data, error } = await callBank<{
        question: QuestionFull;
        imageUrl: string | null;
        status: Status;
        classification: Classification | null;
      }>({ mode: "detail", id: questionId });
      if (cancelled) return;
      if (error === RATE_LIMIT_MESSAGE) {
        setLoadError(error);
        setLoading(false);
        return;
      }
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setQuestion(data.question);
      setImageUrl(data.imageUrl);
      setStatus(data.status || "unseen");
      setClassification(data.classification);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const pickStatus = async (next: Status) => {
    if (!questionId || next === status) return;
    const previous = status;
    setStatus(next); // Optimistic — the control is the only thing affected, and it reverts on failure.
    setSavingStatus(true);
    setStatusError("");
    const { error } = await callBank<{ status: Status }>({ mode: "setStatus", id: questionId, status: next });
    if (error) {
      setStatus(previous);
      setStatusError("Couldn't save that just now.");
    }
    setSavingStatus(false);
  };

  const noText = question ? hasNoText(question.question_text) : false;
  // Raw source tags, minus the leading one (the source's own area/competition label) — kept as provenance
  // now that filtering runs off the canonical taxonomy instead.
  const sourceTags = (question?.topic_tags || []).slice(1);

  return (
    <AppShell>
      <main className="relative mx-auto max-w-3xl px-5 pb-28 pt-8 sm:px-8">
        <Link
          to={backTo}
          className="mb-6 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Question bank
        </Link>

        {loading ? (
          <div className="flex items-center gap-3 py-12">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-[14px] text-muted-foreground">Loading question…</p>
          </div>
        ) : loadError ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <p className="text-[14px] text-foreground">{loadError}</p>
          </div>
        ) : notFound || !question ? (
          <div className="glass-card rounded-2xl p-10 text-center">
            <p className="text-[14px] text-muted-foreground">That question isn't in the bank.</p>
          </div>
        ) : (
          <article className="reveal">
            <header className="border-b border-border pb-5">
              <h1 className="font-display text-[24px] font-semibold text-foreground">{label(question)}</h1>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {classification?.area && <Tag>{areaLabel(classification.area)}</Tag>}
                {(classification?.topics || []).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
                {question.difficulty && <Tag>{question.difficulty}</Tag>}
              </div>
            </header>

            {noText ? (
              // Nothing reproducible stored for this one — lead with the link out rather than burying it,
              // since there is no in-app reading to lead with.
              <div className="py-8">
                <p className="text-[15px] leading-relaxed text-muted-foreground">{question.question_text}</p>
                <a
                  href={question.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Read the official problem <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <div className="py-8">
                <ReferenceQuestionText content={question.question_text} size="large" />
              </div>
            )}

            {question.has_diagram && (
              <figure className="rounded-2xl border border-border bg-accent/15 p-4">
                <figcaption className="micro-label mb-3">Diagram — from the original paper</figcaption>
                {imageUrl ? (
                  // Never redrawn or reconstructed: this is the mirrored page image itself. White background
                  // because the scans are black-on-white and invert badly on the dark canvas.
                  <img
                    src={imageUrl}
                    alt={`Original page image for ${label(question)}`}
                    className="w-full rounded-lg bg-white"
                  />
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    The original page image isn't available here — open the source below to see the diagram.
                  </p>
                )}
              </figure>
            )}

            {question.solution_text && (
              <details className="mt-6 rounded-2xl border border-border bg-accent/15 p-5">
                <summary className="cursor-pointer text-[14px] font-medium text-muted-foreground hover:text-foreground">
                  Solution
                </summary>
                <ReferenceQuestionText content={question.solution_text} className="mt-4" />
              </details>
            )}

            {/* Status. Self-declared on purpose — the corpus carries no solutions, so there is nothing here
                to mark an answer against, and the copy says as much rather than implying a grade. */}
            <section className="mt-8 rounded-2xl border border-border bg-accent/15 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="micro-label">How did you get on?</span>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Your own call — this isn't marked. It counts toward your progress through the bank.
                  </p>
                </div>
                {savingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS_CHOICES.map((s) => (
                  <Chip key={s.value} active={status === s.value} onClick={() => pickStatus(s.value)}>
                    {s.value === "solved" && status === "solved" && (
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                    )}
                    {s.label}
                  </Chip>
                ))}
              </div>
              {statusError && <p className="mt-3 text-[12px] text-destructive">{statusError}</p>}
            </section>

            <footer className="mt-10 border-t border-border pt-5">
              {!noText && (
                <a
                  href={question.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View the original source
                </a>
              )}
              {sourceTags.length > 0 && (
                <div className="mt-4">
                  <span className="micro-label">The source's own tags</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sourceTags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {question.license_note && (
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/60">{question.license_note}</p>
              )}
            </footer>
          </article>
        )}
      </main>
    </AppShell>
  );
}
