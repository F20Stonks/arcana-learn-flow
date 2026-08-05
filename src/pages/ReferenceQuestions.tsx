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
          <div key={q.id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {q.source_competition}{q.year ? ` ${q.year}` : ""} — Question {q.question_number}
              </span>
              {q.difficulty && (
                <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{q.difficulty}</span>
              )}
              {q.topic_tags?.map((t) => (
                <span key={t} className="text-xs text-muted-foreground bg-accent/60 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>

            <MathRenderer content={q.question_text} />

            {q.has_diagram && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
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
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Solution</summary>
                <div className="mt-2 pl-3 border-l-2 border-border">
                  <MathRenderer content={q.solution_text} />
                </div>
              </details>
            )}

            <button
              onClick={() => viewOriginal(q)}
              disabled={openingId === q.id}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
            >
              <ExternalLink className="h-3 w-3" /> View original paper
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
