// Pilot viewer for the reference-question corpus (real ingested papers — STEP, BMO, BPhO, etc.).
// Real auth, real data — not the /dev/ui mock harness — but deliberately not linked from any nav yet:
// reachable by direct URL only, until the UX is approved. See docs/plan context: this proves storage +
// faithful display only; hints/hints/worked-explanation scaffolding is out of scope here.
//
// reference_questions isn't in the generated Supabase types yet — typed locally and cast `as never`/
// `as any` on the client calls, same pattern TrackPapers.tsx already uses for past_papers.
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, ExternalLink, ImageOff } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import "katex/dist/katex.min.css";

interface ReferenceQuestion {
  id: string;
  source_competition: string;
  year: number | null;
  question_number: string | null;
  subject: string;
  topic_tags: string[];
  difficulty: string | null;
  question_text: string;
  solution_text: string | null;
  has_diagram: boolean;
  storage_path: string | null;
  source_url: string;
  license_note: string | null;
}

const BUCKET = "reference-papers";

// The segmentation model writes single newlines between sub-parts ("(a) ...\n(b) ..."), which
// CommonMark treats as a soft break (collapses to a space) rather than a visual line break — every
// sub-part reads as one run-on paragraph. This both forces each part onto its own paragraph AND
// indents roman-numeral parts ("(i)", "(ii)"...) and lettered sub-parts ("(a)", "(b)"...) the way the
// original paper does, by wrapping them in markdown blockquotes (nesting one level deeper for letters)
// — reusing MathRenderer's existing safe blockquote handling rather than injecting raw HTML into
// AI-generated content. The blockquote's "quoted text" look (italic, muted, colored border) is
// neutralized below in QUESTION_TEXT_CLASSES, so only the indentation survives.
const ROMAN_PART = /^\([ivx]+\)/i;
const LETTER_PART = /^\([a-z]\)/;
const withStructure = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (LETTER_PART.test(trimmed)) return `> > ${trimmed}`;
      if (ROMAN_PART.test(trimmed)) return `> ${trimmed}`;
      return trimmed;
    })
    .filter(Boolean)
    .join("\n\n");

// Scoped overrides for MathRenderer's output on this page only (Tailwind arbitrary descendant
// selectors) — larger, more open typography for long multi-part exam questions, without touching
// MathRenderer.tsx itself, so chat/teaching surfaces elsewhere in the app are unaffected.
const QUESTION_TEXT_CLASSES =
  "font-[Newsreader] [&_.math-renderer_p]:text-[16px] [&_.math-renderer_p]:leading-[1.85] [&_.math-renderer_p]:mb-4 " +
  "[&_.math-renderer_p:last-child]:mb-0 [&_.katex-display]:my-3 [&_.katex]:text-[1.05em] " +
  // Blockquotes are reused purely for (i)/(a)-style indentation (see withStructure above) — strip the
  // "quoted text" treatment (border, italic, muted color) so only the indentation is visible. Nested
  // blockquotes (lettered sub-parts) compound the padding automatically for a deeper second level.
  "[&_.math-renderer_blockquote]:border-0 [&_.math-renderer_blockquote]:not-italic " +
  "[&_.math-renderer_blockquote]:text-foreground [&_.math-renderer_blockquote]:pl-6 [&_.math-renderer_blockquote]:mb-0";

export default function ReferenceQuestions() {
  const [params] = useSearchParams();
  const competition = params.get("competition") || "";

  const [questions, setQuestions] = useState<ReferenceQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!competition) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase.from("reference_questions" as never) as any)
        .select("*")
        .eq("source_competition", competition)
        .order("question_number", { ascending: true });
      if (!error && data) setQuestions(data as ReferenceQuestion[]);
      setLoading(false);
    })();
  }, [competition]);

  // Same popup-blocker-safe pattern TrackPapers.tsx uses: open the tab synchronously on the click, then
  // point it at the signed URL once fetched — an await before window.open() commonly gets blocked.
  const viewOriginal = async (q: ReferenceQuestion) => {
    if (!q.storage_path) { window.open(q.source_url, "_blank", "noopener,noreferrer"); return; }
    const tab = window.open("", "_blank");
    setOpeningId(q.id);
    try {
      const { data, error } = await (supabase.storage.from(BUCKET) as any).createSignedUrl(q.storage_path, 3600);
      if (error || !data?.signedUrl) throw error || new Error("No signed URL returned");
      if (tab) tab.location.href = data.signedUrl; else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      if (tab) tab.close();
      window.open(q.source_url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Reference questions</h1>
          <p className="text-xs text-muted-foreground">{competition || "no ?competition= given"}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {!competition && (
          <p className="text-sm text-muted-foreground">
            Pass a competition via the URL, e.g. <code className="bg-accent px-1.5 py-0.5 rounded text-xs">?competition=STEP%20II</code>
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && competition && questions.length === 0 && (
          <p className="text-sm text-muted-foreground">No questions ingested for "{competition}" yet.</p>
        )}

        {questions.map((q) => (
          <div key={q.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 flex-wrap px-6 pt-5 pb-4 border-b border-border/60">
              <span className="text-sm font-semibold text-foreground">
                {q.source_competition}{q.year ? ` ${q.year}` : ""} — Question {q.question_number}
              </span>
              {q.difficulty && (
                <span className="text-xs font-medium text-muted-foreground bg-accent px-2.5 py-1 rounded-full">{q.difficulty}</span>
              )}
              {q.topic_tags?.map((t) => (
                <span key={t} className="text-xs text-muted-foreground bg-accent/60 px-2.5 py-1 rounded-full">{t}</span>
              ))}
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className={QUESTION_TEXT_CLASSES}>
                <MathRenderer content={withStructure(q.question_text)} />
              </div>

              {q.has_diagram && (
                <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <ImageOff className="h-4 w-4 shrink-0" />
                  <span>This question includes a diagram — shown from the original paper, never redrawn.</span>
                  <button
                    onClick={() => viewOriginal(q)}
                    disabled={openingId === q.id}
                    className="ml-auto flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium disabled:opacity-50"
                  >
                    {openingId === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    View original page
                  </button>
                </div>
              )}

              {q.solution_text && (
                <details className="text-sm group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium py-1">Solution</summary>
                  <div className={`mt-3 pl-4 border-l-2 border-border ${QUESTION_TEXT_CLASSES}`}>
                    <MathRenderer content={withStructure(q.solution_text)} />
                  </div>
                </details>
              )}
            </div>

            <div className="px-6 py-3 bg-accent/20 border-t border-border/60">
              <button
                onClick={() => viewOriginal(q)}
                disabled={openingId === q.id}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 disabled:opacity-50"
              >
                <ExternalLink className="h-3 w-3" /> View original paper
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
