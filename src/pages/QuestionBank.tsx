/**
 * Question bank — the student-facing browser over the ingested `reference_questions` corpus, spanning
 * every source competition (STEP, Putnam, IMO, …), not just STEP.
 *
 * Distinct from QuestionAttack (AI-generated questions against a user's own track): every question
 * here is a real, verbatim past-paper/competition question, so nothing on this surface is generated,
 * graded or scored. Read-only browse + read in v1.
 *
 * Two things worth knowing before editing:
 *  - `topic_tags` is each source's OWN free-text vocabulary, not the app's subtopic taxonomy. tag[0] is
 *    the broad area (STEP declares its own, e.g. "Pure Mathematics"; Putnam/IMO rows just carry the
 *    competition name until per-problem topic tagging is built as an AI-assisted follow-up) — the
 *    scrapers write it first deliberately — and the remaining tags are specific topics. That split is
 *    what makes a two-level filter possible without inventing a mapping. Do NOT try to line these up
 *    with `subtopics` rows; that's an unsolved design problem, not an oversight.
 *  - Not every row has real question text. STEP rows are fully reproduced (the source has no
 *    redistribution restriction found). Putnam/IMO rows are index-only — their archives explicitly
 *    restrict (Putnam) or simply don't grant (IMO) redistribution of problem text, so those rows carry
 *    metadata plus a link to the official source instead (see `isIndexOnly` below, keyed off
 *    `license_note`, and scripts/scrape-putnam-index.mjs / scrape-imo-index.mjs).
 *  - reference_questions isn't in the generated Supabase types yet, so the client calls are cast
 *    `as never`/`as any`, the same pattern TrackPapers.tsx uses for past_papers.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, ExternalLink, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CommandBar from "@/components/CommandBar";
import ReferenceQuestionText from "@/components/ReferenceQuestionText";

const BUCKET = "reference-papers";
const PAGE_SIZE = 60;

/** Row shape for the browse list — deliberately without question_text (1200+ rows of it is megabytes). */
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

const area = (q: { topic_tags: string[] | null }) => q.topic_tags?.[0] || "Other";
const specificTags = (q: { topic_tags: string[] | null }) => (q.topic_tags || []).slice(1);
const label = (q: { source_competition: string; year: number | null; question_number: string | null }) =>
  `${q.source_competition}${q.year ? ` ${q.year}` : ""}${q.question_number ? ` · Q${q.question_number}` : ""}`;
// Index-only rows (Putnam, IMO, …) never got their question text copied in — see the scrapers' shared
// LICENSE_NOTE wording, the one signal both intentionally carry for this check.
const isIndexOnly = (q: { license_note: string | null }) => !!q.license_note?.includes("not reproduced here");

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

  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Filters live in the URL so a filtered view is shareable and survives the back button out of a
  // question. Empty string = "all" for each.
  const competition = params.get("competition") || "";
  const selectedArea = params.get("area") || "";
  const tag = params.get("tag") || "";
  const year = params.get("year") || "";
  const query = params.get("q") || "";

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing the area invalidates whatever specific tag was picked inside the old one.
    if (key === "area") next.delete("tag");
    setParams(next, { replace: true });
    setVisible(PAGE_SIZE);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        // PostgREST caps a plain select at 1000 rows and the corpus is larger than that, so page
        // through explicitly rather than silently truncating the bank at 1000 questions.
        const all: QuestionSummary[] = [];
        const CHUNK = 1000;
        for (let from = 0; ; from += CHUNK) {
          const { data, error } = await (supabase.from("reference_questions" as never) as any)
            .select("id, source_competition, year, question_number, topic_tags, has_diagram")
            .eq("subject", "Mathematics")
            .order("year", { ascending: false })
            .order("source_competition", { ascending: true })
            .order("question_number", { ascending: true })
            .range(from, from + CHUNK - 1);
          if (error) throw error;
          const batch = (data || []) as QuestionSummary[];
          all.push(...batch);
          if (batch.length < CHUNK) break;
        }
        setQuestions(all);
      } catch (err) {
        console.error("Question bank load failed:", err);
        setLoadError("Couldn't load the question bank. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const competitions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) counts.set(q.source_competition, (counts.get(q.source_competition) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [questions]);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      if (competition && q.source_competition !== competition) continue;
      counts.set(area(q), (counts.get(area(q)) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [questions, competition]);

  const years = useMemo(
    () => [...new Set(questions.map((q) => q.year).filter((y): y is number => !!y))].sort((a, b) => b - a),
    [questions],
  );

  // Specific topics are only offered once an area is chosen — there are dozens of them across the whole
  // corpus, which is an unusable flat list, but a real menu within one area.
  const tagsInArea = useMemo(() => {
    if (!selectedArea) return [];
    const counts = new Map<string, number>();
    for (const q of questions) {
      if (area(q) !== selectedArea) continue;
      for (const t of specificTags(q)) counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [questions, selectedArea]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return questions.filter((q) => {
      if (competition && q.source_competition !== competition) return false;
      if (selectedArea && area(q) !== selectedArea) return false;
      if (tag && !specificTags(q).includes(tag)) return false;
      if (year && String(q.year) !== year) return false;
      if (needle && !(q.topic_tags || []).join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [questions, competition, selectedArea, tag, year, query]);

  const hasFilters = !!(competition || selectedArea || tag || year || query);

  return (
    <div className="relative min-h-screen bg-background">
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 65%)",
        }}
      />

      <CommandBar />

      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <button
          onClick={() => navigate("/dashboard")}
          className="reveal mb-6 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
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
          {competitions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="micro-label mr-1">Competition</span>
              <Chip active={!competition} onClick={() => setFilter("competition", "")}>
                All
              </Chip>
              {competitions.map(([c, n]) => (
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

          {areas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="micro-label mr-1">Area</span>
              <Chip active={!selectedArea} onClick={() => setFilter("area", "")}>
                All
              </Chip>
              {areas.map(([a, n]) => (
                <Chip key={a} active={selectedArea === a} onClick={() => setFilter("area", selectedArea === a ? "" : a)}>
                  {a} <span className="readout ml-1 text-[11px] opacity-60">{n}</span>
                </Chip>
              ))}
            </div>
          )}

          {tagsInArea.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-accent/15 p-3">
              <span className="micro-label mr-1">Topic</span>
              <Chip active={!tag} onClick={() => setFilter("tag", "")}>
                All in {selectedArea}
              </Chip>
              {tagsInArea.map(([t, n]) => (
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
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={() => {
                  setParams(new URLSearchParams(), { replace: true });
                  setVisible(PAGE_SIZE);
                }}
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
                  {filtered.length} question{filtered.length === 1 ? "" : "s"}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="glass-card rounded-2xl p-10 text-center">
                  <p className="text-[14px] text-muted-foreground">Nothing matches those filters.</p>
                </div>
              ) : (
                <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {filtered.slice(0, visible).map((q) => (
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

              {visible < filtered.length && (
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="mt-6 w-full rounded-full border border-border py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

/* ─────────────────────────── single question ─────────────────────────── */

export function QuestionBankDetail() {
  const { questionId } = useParams();
  const location = useLocation();
  const backTo = `/question-bank${(location.state as { from?: string } | null)?.from || ""}`;

  const [question, setQuestion] = useState<QuestionFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!questionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setImageUrl(null);
      setImageFailed(false);
      const { data, error } = await (supabase.from("reference_questions" as never) as any)
        .select("*")
        .eq("id", questionId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const q = data as QuestionFull;
      setQuestion(q);
      setLoading(false);

      // The bucket is private, so the mirrored page image is only reachable through a signed URL.
      if (q.storage_path) {
        const { data: signed } = await (supabase.storage.from(BUCKET) as any).createSignedUrl(q.storage_path, 3600);
        if (!cancelled) {
          if (signed?.signedUrl) setImageUrl(signed.signedUrl);
          else setImageFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const indexOnly = question ? isIndexOnly(question) : false;

  return (
    <div className="relative min-h-screen bg-background">
      <CommandBar />

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
                    onError={() => setImageFailed(true)}
                  />
                ) : imageFailed || !question.storage_path ? (
                  <p className="text-[13px] text-muted-foreground">
                    The original page image isn't available here — open the source below to see the diagram.
                  </p>
                ) : (
                  <div className="flex items-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-[13px]">Loading the original page…</span>
                  </div>
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
    </div>
  );
}
