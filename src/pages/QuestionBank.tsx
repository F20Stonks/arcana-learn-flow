/**
 * Question bank — the student-facing browser over the ingested `reference_questions` corpus, spanning
 * every source competition (STEP, Putnam, IMO, …), not just STEP.
 *
 * Distinct from QuestionAttack (AI-generated questions against a user's own track): every question
 * here is a real, verbatim past-paper/competition question, so nothing on this surface is generated,
 * graded or scored. Read-only browse + read in v1.
 *
 * Data access goes entirely through the `reference-questions` edge function, NOT direct table queries —
 * this used to fetch the whole corpus into the browser just to compute filter-chip counts client-side,
 * which is also exactly the shape a scraper wants (one authenticated request, whole table). The edge
 * function does server-side filtering/aggregation (via reference_question_list/facets RPCs) and rate
 * limits per user, weighting full-question-text ("detail") requests heavier than list/facet ones.
 *
 * Two things worth knowing before editing:
 *  - `topic_tags` is each source's OWN free-text vocabulary, not the app's subtopic taxonomy. tag[0] is
 *    the broad area (STEP declares its own, e.g. "Pure Mathematics"; Putnam/IMO rows just carry the
 *    competition name until per-problem topic tagging is built as an AI-assisted follow-up) — the
 *    scrapers write it first deliberately — and the remaining tags are specific topics. Do NOT try to
 *    line these up with `subtopics` rows; that's an unsolved design problem, not an oversight.
 *  - Not every row has real question text. STEP rows are fully reproduced (the source has no
 *    redistribution restriction found). Putnam/IMO rows are index-only — their archives explicitly
 *    restrict (Putnam) or simply don't grant (IMO) redistribution of problem text, so those rows carry
 *    metadata plus a link to the official source instead (see `isIndexOnly` below, keyed off
 *    `license_note`, and scripts/scrape-putnam-index.mjs / scrape-imo-index.mjs).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, ExternalLink, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import ReferenceQuestionText from "@/components/ReferenceQuestionText";

interface QuestionSummary {
  id: string;
  source_competition: string;
  year: number | null;
  question_number: string | null;
  topic_tags: string[];
  has_diagram: boolean;
}

interface QuestionFull extends QuestionSummary {
  subject: string;
  difficulty: string | null;
  question_text: string;
  solution_text: string | null;
  storage_path: string | null;
  source_url: string;
  license_note: string | null;
}

interface Facets {
  competitions: [string, number][];
  areas: [string, number][];
  years: number[];
  tagsInArea: [string, number][];
}

const EMPTY_FACETS: Facets = { competitions: [], areas: [], years: [], tagsInArea: [] };

const area = (q: { topic_tags: string[] | null }) => q.topic_tags?.[0] || "Other";
const specificTags = (q: { topic_tags: string[] | null }) => (q.topic_tags || []).slice(1);
const label = (q: { source_competition: string; year: number | null; question_number: string | null }) =>
  `${q.source_competition}${q.year ? ` ${q.year}` : ""}${q.question_number ? ` · Q${q.question_number}` : ""}`;
// Index-only rows (Putnam, IMO, …) never got their question text copied in — see the scrapers' shared
// LICENSE_NOTE wording, the one signal both intentionally carry for this check.
const isIndexOnly = (q: { license_note: string | null }) => !!q.license_note?.includes("not reproduced here");

// Friendly copy for the one error shape worth distinguishing from a generic load failure.
const RATE_LIMIT_MESSAGE = "Slow down a little — you've hit the read limit. Try again in a few minutes.";

async function callBank<T>(body: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const resp = await supabase.functions.invoke("reference-questions", { body });
  if (resp.error) {
    // supabase-js surfaces a non-2xx as resp.error without the parsed body in some versions — status is
    // still on the underlying context where available, but the safest cross-version check is the message.
    const status = (resp.error as { context?: { status?: number } })?.context?.status;
    if (status === 429) return { data: null, error: RATE_LIMIT_MESSAGE };
    return { data: null, error: resp.error.message || "Request failed." };
  }
  return { data: resp.data as T, error: null };
}

/* ─────────────────────────── shared bits ─────────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
  return (
    <span className="rounded-full bg-accent/60 px-2.5 py-1 text-[11px] text-muted-foreground">{children}</span>
  );
}

/* ─────────────────────────── browse list ─────────────────────────── */

export default function QuestionBank() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  // This page is reachable by waitlisted users (see App.tsx — deliberately gated by ProtectedRoute, not
  // DashboardGuard) who don't have a real /dashboard to go back to yet; send them to /waitlist instead
  // of bouncing them through a redirect they didn't ask for.
  const backHome = profile && profile.waitlist_status !== "approved" ? "/waitlist" : "/dashboard";

  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [facets, setFacets] = useState<Facets>(EMPTY_FACETS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Filters live in the URL so a filtered view is shareable and survives the back button out of a
  // question. Empty string = "all" for each.
  const competition = params.get("competition") || "";
  const selectedArea = params.get("area") || "";
  const tag = params.get("tag") || "";
  const year = params.get("year") || "";
  const query = params.get("q") || "";

  // The search box updates the URL (and therefore `query`) on every keystroke for a responsive feel, but
  // the network call is debounced off a separate value — otherwise every keystroke is a billed request.
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing the area invalidates whatever specific tag was picked inside the old one.
    if (key === "area") next.delete("tag");
    setParams(next, { replace: true });
  };

  // Facets only depend on competition/area (see reference_question_facets' signature) — tag/year/search
  // changes don't need a re-fetch here.
  useEffect(() => {
    (async () => {
      const { data, error } = await callBank<{ facets: Facets }>({
        mode: "facets",
        competition: competition || undefined,
        area: selectedArea || undefined,
      });
      if (data) setFacets(data.facets);
      else if (error) console.error("Facet load failed:", error);
    })();
  }, [competition, selectedArea]);

  // The list re-fetches from the start whenever any filter changes.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError("");
      const { data, error } = await callBank<{ questions: QuestionSummary[]; totalCount: number; nextCursor: number | null }>({
        mode: "list",
        filters: {
          competition: competition || undefined,
          area: selectedArea || undefined,
          tag: tag || undefined,
          year: year ? Number(year) : undefined,
          search: debouncedQuery || undefined,
        },
        cursor: 0,
      });
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
  }, [competition, selectedArea, tag, year, debouncedQuery]);

  const loadMore = async () => {
    if (cursor === null) return;
    setLoadingMore(true);
    const { data, error } = await callBank<{ questions: QuestionSummary[]; totalCount: number; nextCursor: number | null }>({
      mode: "list",
      filters: {
        competition: competition || undefined,
        area: selectedArea || undefined,
        tag: tag || undefined,
        year: year ? Number(year) : undefined,
        search: debouncedQuery || undefined,
      },
      cursor,
    });
    if (data) {
      setQuestions((prev) => [...prev, ...data.questions]);
      setCursor(data.nextCursor);
    } else {
      console.error("Question bank load-more failed:", error);
    }
    setLoadingMore(false);
  };

  const hasFilters = !!(competition || selectedArea || tag || year || query);

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
          <ArrowLeft className="h-3.5 w-3.5" /> {backHome === "/waitlist" ? "Back" : "Dashboard"}
        </button>
        <header className="reveal" style={{ animationDelay: "60ms" }}>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground sm:text-[32px]">
            Question <span className="font-serif-accent font-normal text-foreground/80">bank</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
            Real questions from STEP, Putnam, the IMO and more. Browse by competition and topic, then
            read one properly.
          </p>
        </header>

        {/* Filters */}
        <section className="reveal mt-8 space-y-4" style={{ animationDelay: "140ms" }}>
          {facets.competitions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="micro-label mr-1">Competition</span>
              <Chip active={!competition} onClick={() => setFilter("competition", "")}>
                All
              </Chip>
              {facets.competitions.map(([c, n]) => (
                <Chip
                  key={c}
                  active={competition === c}
                  onClick={() => setFilter("competition", competition === c ? "" : c)}
                >
                  {c} <span className="readout ml-1 text-[11px] opacity-60">{n}</span>
                </Chip>
              ))}
            </div>
          )}

          {facets.areas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="micro-label mr-1">Area</span>
              <Chip active={!selectedArea} onClick={() => setFilter("area", "")}>
                All
              </Chip>
              {facets.areas.map(([a, n]) => (
                <Chip key={a} active={selectedArea === a} onClick={() => setFilter("area", selectedArea === a ? "" : a)}>
                  {a} <span className="readout ml-1 text-[11px] opacity-60">{n}</span>
                </Chip>
              ))}
            </div>
          )}

          {facets.tagsInArea.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-accent/15 p-3">
              <span className="micro-label mr-1">Topic</span>
              <Chip active={!tag} onClick={() => setFilter("tag", "")}>
                All in {selectedArea}
              </Chip>
              {facets.tagsInArea.map(([t, n]) => (
                <Chip key={t} active={tag === t} onClick={() => setFilter("tag", tag === t ? "" : t)}>
                  {t} <span className="readout ml-1 text-[11px] opacity-60">{n}</span>
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setFilter("q", e.target.value)}
                placeholder="Search topics — e.g. complex numbers, projectiles, Poisson"
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="readout text-[13px] font-medium text-foreground">{label(q)}</span>
                          {q.has_diagram && (
                            <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-primary">
                              diagram
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Tag>{area(q)}</Tag>
                          {specificTags(q).map((t) => (
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
      </main>
    </AppShell>
  );
}

/* ─────────────────────────── single question ─────────────────────────── */

export function QuestionBankDetail() {
  const { questionId } = useParams();
  const location = useLocation();
  const backTo = `/question-bank${(location.state as { from?: string } | null)?.from || ""}`;

  const [question, setQuestion] = useState<QuestionFull | null>(null);
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
      const { data, error } = await callBank<{ question: QuestionFull; imageUrl: string | null }>({
        mode: "detail",
        id: questionId,
      });
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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const indexOnly = question ? isIndexOnly(question) : false;

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
                <Tag>{area(question)}</Tag>
                {specificTags(question).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </header>

            {indexOnly ? (
              // No verbatim text for this source (see isIndexOnly) — lead with the link out instead of
              // burying it in the footer, since there's no in-app reading to lead with.
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
                  // Never redrawn or reconstructed: this is the mirrored page image itself. White
                  // background because the scans are black-on-white and invert badly on the dark canvas.
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

            <footer className="mt-10 border-t border-border pt-5">
              {!indexOnly && (
                <a
                  href={question.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View the original source
                </a>
              )}
              {question.license_note && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/60">{question.license_note}</p>
              )}
            </footer>
          </article>
        )}
      </main>
    </AppShell>
  );
}
