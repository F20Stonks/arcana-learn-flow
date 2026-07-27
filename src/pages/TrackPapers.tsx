import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { ArrowLeft, Loader as Loader2, FileText, Search, ExternalLink, Sparkles, ChevronRight, CircleCheck as CheckCircle2, Circle as XCircle, Zap, Brain } from "lucide-react";
import MathRenderer from "@/components/MathRenderer";
import "katex/dist/katex.min.css";

type TopicWithSubs = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };
type Difficulty = "easy" | "medium" | "hard" | "exam";

// past_papers / generated_papers aren't in the generated Supabase types yet. Typed
// locally in the meantime; supabase calls touching these tables are cast `as never`/`as any` below
// (same pattern used for learning_tracks.archived_at before its migration landed).
interface PastPaper {
  id: string;
  board: string;
  subject: string;
  level: string | null;
  title: string;
  year: string | null;
  paper_label: string | null;
  source_url: string;
  storage_path: string | null;
  created_at: string;
}
interface GeneratedPaper {
  id: string;
  user_id: string;
  track_id: string;
  title: string;
  difficulty: Difficulty;
  topics: unknown;
  questions: unknown;
  answers: unknown;
  score: number | null;
  total_marks: number;
  completed_at: string | null;
  created_at: string;
}

interface PaperQuestion {
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  topic: string;
  marks?: number;
}

type Section = "real" | "generate";
type TakingPhase = "question" | "feedback" | "results";

export default function TrackPapers() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<TopicWithSubs[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("real");

  // Real past papers
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [papersSearched, setPapersSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  // Generated papers list + config
  const [savedPapers, setSavedPapers] = useState<GeneratedPaper[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionCount, setQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  // Paper-taking state
  const [activePaper, setActivePaper] = useState<GeneratedPaper | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answersSoFar, setAnswersSoFar] = useState<{ answer: string; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [takingPhase, setTakingPhase] = useState<TakingPhase>("question");
  const [gradingLoading, setGradingLoading] = useState(false);

  useEffect(() => {
    if (!trackId || !user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, user]);

  const loadData = async () => {
    const { data: t } = await supabase.from("learning_tracks").select("*").eq("id", trackId!).single();
    setTrack(t);
    const { data: rawTopics } = await supabase.from("topics").select("*").eq("track_id", trackId!).order("order_index");
    if (rawTopics) {
      const enriched: TopicWithSubs[] = [];
      for (const topic of rawTopics) {
        const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
        enriched.push({ ...topic, subtopics: subs || [] });
      }
      setTopics(enriched);
      setSelectedTopics(new Set(enriched.map((tp) => tp.id)));
    }
    const { data: gp } = await (supabase.from("generated_papers" as never) as any)
      .select("*").eq("track_id", trackId!).eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setSavedPapers((gp || []) as GeneratedPaper[]);
    setLoading(false);
  };

  const searchPastPapers = async () => {
    if (!track) return;
    setSearching(true);
    try {
      const resp = await supabase.functions.invoke("resolve-past-papers", {
        body: { board: track.exam_board, subject: track.subject, level: track.level, examHint: track.title },
      });
      setPastPapers((resp.data?.papers || []) as PastPaper[]);
    } catch (e) {
      console.error("Past paper search failed:", e);
    } finally {
      setSearching(false);
      setPapersSearched(true);
    }
  };

  // Signed URLs work against a private/unregistered bucket exactly like a public one — they just carry a
  // short-lived token instead of relying on the bucket's own public flag. Avoids needing the past-papers
  // bucket to be marked public at all.
  const [openingPaperId, setOpeningPaperId] = useState<string | null>(null);
  const openPaper = async (p: PastPaper) => {
    if (!p.storage_path) { window.open(p.source_url, "_blank", "noopener,noreferrer"); return; }
    // Open the tab SYNCHRONOUSLY, inside the click handler, before any await — popup blockers key off
    // direct user-gesture timing, and a window.open() after an awaited fetch commonly gets blocked even
    // though this one isn't a stray popup. Navigate that already-open tab once the signed URL resolves.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    setOpeningPaperId(p.id);
    try {
      const { data, error } = await (supabase.storage.from("past-papers") as any).createSignedUrl(p.storage_path, 3600);
      if (error || !data?.signedUrl) throw error || new Error("No signed URL returned");
      if (tab) tab.location.href = data.signedUrl; else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("Failed to open mirrored paper, falling back to source:", e);
      if (tab) tab.location.href = p.source_url; else window.open(p.source_url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningPaperId(null);
    }
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const generatePaper = async () => {
    if (selectedTopics.size === 0 || !track) return;
    setGenerating(true);
    const topicPayload = topics.filter((t) => selectedTopics.has(t.id)).map((t) => ({ topic: t.title, subtopics: t.subtopics.map((s) => s.title) }));
    try {
      const resp = await supabase.functions.invoke("generate-paper", {
        body: {
          trackId, subject: track.subject, level: track.level, examBoard: track.exam_board,
          topics: topicPayload, difficulty, questionCount,
        },
      });
      if (resp.error || !resp.data?.paper) throw resp.error || new Error("No paper returned");
      const paper = resp.data.paper as GeneratedPaper;
      setSavedPapers((prev) => [paper, ...prev]);
      startPaper(paper);
    } catch (e) {
      console.error("Paper generation failed:", e);
    } finally {
      setGenerating(false);
    }
  };

  const startPaper = (paper: GeneratedPaper) => {
    const existingAnswers = (paper.answers as { answer: string; correct: boolean }[]) || [];
    setActivePaper(paper);
    setAnswersSoFar(existingAnswers);
    setCurrentIdx(existingAnswers.length);
    setAnswer("");
    setSelectedOption(null);
    setFeedback(null);
    setTakingPhase(existingAnswers.length >= (paper.questions as PaperQuestion[]).length ? "results" : "question");
  };

  const questions = (activePaper?.questions as PaperQuestion[]) || [];
  const currentQ = questions[currentIdx];

  const submitAnswer = async () => {
    if (!currentQ || !activePaper) return;
    const userAnswer = currentQ.options ? currentQ.options[selectedOption!] : answer;
    if (!userAnswer?.trim()) return;
    setGradingLoading(true);
    let correct = false;
    let explanationText = currentQ.explanation;
    try {
      const resp = await supabase.functions.invoke("question-attack", {
        body: {
          mode: "assess", question: currentQ.question, correctAnswer: currentQ.correct_answer,
          userAnswer, explanation: currentQ.explanation, subject: track?.subject, level: track?.level,
        },
      });
      correct = resp.data?.correct ?? false;
      explanationText = resp.data?.feedback || currentQ.explanation;
    } catch {
      correct = userAnswer.trim().toLowerCase() === currentQ.correct_answer.trim().toLowerCase();
    }
    const nextAnswers = [...answersSoFar, { answer: userAnswer, correct }];
    setAnswersSoFar(nextAnswers);
    setFeedback({ correct, explanation: explanationText });
    setTakingPhase("feedback");
    setGradingLoading(false);
    // Persist progress so the paper is genuinely resumable, not just in-memory.
    await (supabase.from("generated_papers" as never) as any).update({ answers: nextAnswers }).eq("id", activePaper.id);
  };

  const nextQuestion = async () => {
    if (!activePaper) return;
    if (currentIdx + 1 >= questions.length) {
      const score = answersSoFar.filter((a) => a.correct).length;
      await (supabase.from("generated_papers" as never) as any).update({ score, completed_at: new Date().toISOString() }).eq("id", activePaper.id);
      setSavedPapers((prev) => prev.map((p) => (p.id === activePaper.id ? { ...p, score, completed_at: new Date().toISOString() } : p)));
      setTakingPhase("results");
    } else {
      setCurrentIdx((i) => i + 1);
      setAnswer("");
      setSelectedOption(null);
      setFeedback(null);
      setTakingPhase("question");
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // --- Taking / reviewing an active paper ---
  if (activePaper) {
    const score = answersSoFar.filter((a) => a.correct).length;
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setActivePaper(null)} className="text-muted-foreground hover:text-foreground shrink-0"><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">{activePaper.title}</h1>
              <p className="text-xs text-muted-foreground">{activePaper.difficulty} · {activePaper.total_marks} marks</p>
            </div>
          </div>
          {takingPhase !== "results" && (
            <span className="text-xs text-muted-foreground shrink-0">{currentIdx + 1}/{questions.length}</span>
          )}
        </header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          {takingPhase === "question" && currentQ && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{currentQ.topic}</span>
                  <span className="text-xs text-muted-foreground">{currentQ.marks || 1} mark{(currentQ.marks || 1) === 1 ? "" : "s"}</span>
                </div>
                <MathRenderer content={currentQ.question} />
              </div>

              {currentQ.options ? (
                <div className="space-y-2">
                  {currentQ.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOption(i)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        selectedOption === i ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full border border-current flex items-center justify-center text-xs font-medium shrink-0">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <MathRenderer content={opt} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer…"
                  rows={4}
                  className="w-full bg-card border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground outline-hidden focus:border-primary/30 resize-none"
                />
              )}

              <button
                onClick={submitAnswer}
                disabled={(currentQ.options ? selectedOption === null : !answer.trim()) || gradingLoading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
              >
                {gradingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Answer"}
              </button>
            </div>
          )}

          {takingPhase === "feedback" && feedback && (
            <div className="space-y-4">
              <div className={`rounded-xl p-6 border ${feedback.correct ? "bg-status-green/10 border-status-green/30" : "bg-destructive/10 border-destructive/30"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {feedback.correct
                    ? <><CheckCircle2 className="h-5 w-5 text-status-green" /><span className="text-sm font-semibold text-status-green">Correct!</span></>
                    : <><XCircle className="h-5 w-5 text-destructive" /><span className="text-sm font-semibold text-destructive">Not quite</span></>}
                </div>
                <MathRenderer content={feedback.explanation} />
              </div>
              <button
                onClick={nextQuestion}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {currentIdx + 1 >= questions.length ? "See Results" : "Next Question"} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {takingPhase === "results" && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <div className="text-4xl font-bold text-foreground mb-2">{score}/{questions.length}</div>
                <p className="text-sm text-muted-foreground mb-1">{Math.round((score / questions.length) * 100)}% correct</p>
                <div className="flex items-center justify-center gap-1 text-xp mt-3">
                  <Zap className="h-4 w-4" /><span className="text-sm font-semibold">+{score * 10} XP</span>
                </div>
              </div>
              <button
                onClick={() => setActivePaper(null)}
                className="w-full py-3 rounded-xl bg-accent text-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
              >
                Back to Papers
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- Papers hub: real past papers + generate ---
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate(`/track/${trackId}`)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Papers</h1>
          <p className="text-xs text-muted-foreground">{track?.title}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex gap-1 bg-accent rounded-lg p-1 w-fit">
          <button
            onClick={() => setSection("real")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${section === "real" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Past Papers
          </button>
          <button
            onClick={() => setSection("generate")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${section === "generate" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Generate a Paper
          </button>
        </div>

        {section === "real" && (
          <div className="space-y-4">
            {!papersSearched && (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Find real official past papers for {track?.exam_board || "your board"} {track?.subject}.
                </p>
                <button
                  onClick={searchPastPapers}
                  disabled={searching}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {searching ? "Searching…" : "Find past papers"}
                </button>
              </div>
            )}

            {papersSearched && pastPapers.length === 0 && !searching && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No official past papers found yet for this board/subject combination.
              </p>
            )}

            {pastPapers.map((p) => (
              <button
                key={p.id}
                onClick={() => openPaper(p)}
                disabled={openingPaperId === p.id}
                className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors text-left disabled:opacity-60"
              >
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{[p.year, p.paper_label].filter(Boolean).join(" · ") || "Official past paper"}</p>
                </div>
                {openingPaperId === p.id
                  ? <Loader2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 animate-spin" />
                  : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {section === "generate" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Topics to include</h3>
                <button
                  onClick={() => {
                    if (selectedTopics.size === topics.length) setSelectedTopics(new Set());
                    else setSelectedTopics(new Set(topics.map((t) => t.id)));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {selectedTopics.size === topics.length ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="space-y-2">
                {topics.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <input type="checkbox" checked={selectedTopics.has(t.id)} onChange={() => toggleTopic(t.id)} className="rounded border-border text-primary focus:ring-primary" />
                    <span className="text-sm text-foreground">{t.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Difficulty</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["easy", "medium", "hard", "exam"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${difficulty === d ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}
                  >
                    {d === "exam" ? `${track?.level || "Exam"} style` : d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Questions</h3>
              <div className="flex gap-2 flex-wrap">
                {[10, 15, 20, 25].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${questionCount === n ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generatePaper}
              disabled={selectedTopics.size === 0 || generating}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : `Generate Paper (${questionCount} questions)`}
            </button>

            {savedPapers.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your papers</h3>
                <div className="space-y-2">
                  {savedPapers.map((p) => {
                    const qs = (p.questions as PaperQuestion[]) || [];
                    const answered = ((p.answers as unknown[]) || []).length;
                    const done = !!p.completed_at;
                    return (
                      <button
                        key={p.id}
                        onClick={() => startPaper(p)}
                        className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors text-left"
                      >
                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Brain className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {done ? `${p.score}/${qs.length} correct` : answered > 0 ? `${answered}/${qs.length} answered — resume` : `${qs.length} questions`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
