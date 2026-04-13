import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Zap, CheckCircle2, XCircle, ChevronRight, Target, Brain } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

type TopicWithSubs = Tables<"topics"> & { subtopics: Tables<"subtopics">[] };

interface Question {
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  topic: string;
}

function renderMath(content: string) {
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  while (remaining.includes("$$")) {
    const start = remaining.indexOf("$$");
    const end = remaining.indexOf("$$", start + 2);
    if (end === -1) break;
    if (start > 0) parts.push(<ReactMarkdown key={key++}>{remaining.slice(0, start)}</ReactMarkdown>);
    try { parts.push(<BlockMath key={key++} math={remaining.slice(start + 2, end)} />); } catch { parts.push(<code key={key++}>{remaining.slice(start + 2, end)}</code>); }
    remaining = remaining.slice(end + 2);
  }

  if (remaining.includes("$")) {
    const regex = /\$([^$]+)\$/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) parts.push(<ReactMarkdown key={key++}>{remaining.slice(lastIndex, match.index)}</ReactMarkdown>);
      try { parts.push(<InlineMath key={key++} math={match[1]} />); } catch { parts.push(<code key={key++}>{match[1]}</code>); }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < remaining.length) parts.push(<ReactMarkdown key={key++}>{remaining.slice(lastIndex)}</ReactMarkdown>);
  } else if (remaining) {
    parts.push(<ReactMarkdown key={key++}>{remaining}</ReactMarkdown>);
  }
  return parts;
}

type Phase = "config" | "loading" | "question" | "feedback" | "results";

export default function QuestionAttack() {
  const { trackId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [topics, setTopics] = useState<TopicWithSubs[]>([]);
  const [loading, setLoading] = useState(true);

  // Config state
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "exam">("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [questionType, setQuestionType] = useState<"mixed" | "mcq" | "open">("mixed");

  // Quiz state
  const [phase, setPhase] = useState<Phase>("config");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [score, setScore] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    if (!trackId || !user) return;
    loadData();
  }, [trackId, user]);

  const loadData = async () => {
    const { data: t } = await supabase.from("learning_tracks").select("*").eq("id", trackId!).single();
    setTrack(t);

    const { data: rawTopics } = await supabase.from("topics").select("*").eq("track_id", trackId!).order("order_index");
    if (!rawTopics) { setLoading(false); return; }

    const enriched: TopicWithSubs[] = [];
    for (const topic of rawTopics) {
      const { data: subs } = await supabase.from("subtopics").select("*").eq("topic_id", topic.id).order("order_index");
      enriched.push({ ...topic, subtopics: subs || [] });
    }
    setTopics(enriched);
    // Select all by default
    setSelectedTopics(new Set(enriched.map(t => t.id)));
    setLoading(false);
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startQuiz = async () => {
    if (selectedTopics.size === 0) return;
    setPhase("loading");

    const selectedTopicNames = topics
      .filter(t => selectedTopics.has(t.id))
      .map(t => ({
        topic: t.title,
        subtopics: t.subtopics.map(s => s.title),
      }));

    try {
      const resp = await supabase.functions.invoke("question-attack", {
        body: {
          subject: track?.subject,
          level: track?.level,
          examBoard: track?.exam_board,
          topics: selectedTopicNames,
          difficulty,
          questionCount,
          questionType,
        },
      });

      if (resp.error) throw resp.error;
      const data = resp.data;
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentIdx(0);
        setScore(0);
        setPhase("question");
      } else {
        throw new Error("No questions generated");
      }
    } catch (err) {
      console.error("Question generation failed:", err);
      setPhase("config");
    }
  };

  const submitAnswer = async () => {
    const q = questions[currentIdx];
    if (!q) return;

    const userAnswer = q.options ? q.options[selectedOption!] : answer;
    if (!userAnswer?.trim()) return;

    setFeedbackLoading(true);

    try {
      const resp = await supabase.functions.invoke("question-attack", {
        body: {
          mode: "assess",
          question: q.question,
          correctAnswer: q.correct_answer,
          userAnswer,
          explanation: q.explanation,
          subject: track?.subject,
          level: track?.level,
        },
      });

      const data = resp.data;
      const isCorrect = data?.correct ?? false;
      if (isCorrect) setScore(s => s + 1);
      setFeedback({ correct: isCorrect, explanation: data?.feedback || q.explanation });
      setPhase("feedback");
    } catch {
      // Fallback: simple string match
      const isCorrect = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
      if (isCorrect) setScore(s => s + 1);
      setFeedback({ correct: isCorrect, explanation: q.explanation });
      setPhase("feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 >= questions.length) {
      setPhase("results");
    } else {
      setCurrentIdx(i => i + 1);
      setAnswer("");
      setSelectedOption(null);
      setFeedback(null);
      setPhase("question");
    }
  };

  const currentQ = questions[currentIdx];

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/track/${trackId}`)} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Question Attack
            </h1>
            <p className="text-xs text-muted-foreground">{track?.title}</p>
          </div>
        </div>
        {phase !== "config" && phase !== "loading" && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{currentIdx + 1}/{questions.length}</span>
            <span className="text-xp font-medium">{score} correct</span>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* CONFIG */}
        {phase === "config" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Configure your attack</h2>
              <p className="text-sm text-muted-foreground">Pick topics and difficulty, then Jarvis generates questions tailored to your level.</p>
            </div>

            {/* Topic selection */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Topics to test</h3>
              <div className="space-y-2">
                {topics.map(t => (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(t.id)}
                      onChange={() => toggleTopic(t.id)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{t.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{t.subtopics.length} subtopics</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Difficulty</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["easy", "medium", "hard", "exam"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      difficulty === d ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d === "exam" ? `${track?.level || "Exam"} style` : d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Question count & type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Questions</h3>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        questionCount === n ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Type</h3>
                <div className="flex gap-2">
                  {([["mixed", "Mixed"], ["mcq", "MCQ"], ["open", "Open"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setQuestionType(val)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        questionType === val ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={startQuiz}
              disabled={selectedTopics.size === 0}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
            >
              <Brain className="h-4 w-4" /> Start Attack ({questionCount} questions)
            </button>
          </div>
        )}

        {/* LOADING */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Jarvis is generating your questions...</p>
          </div>
        )}

        {/* QUESTION */}
        {phase === "question" && currentQ && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">{currentQ.topic}</span>
                <span className="text-xs text-muted-foreground">{currentQ.difficulty}</span>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-foreground">
                {renderMath(currentQ.question)}
              </div>
            </div>

            {currentQ.options ? (
              <div className="space-y-2">
                {currentQ.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(i)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      selectedOption === i
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full border border-current flex items-center justify-center text-xs font-medium shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <div className="prose prose-sm prose-invert max-w-none">{renderMath(opt)}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                rows={4}
                className="w-full bg-card border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/30 resize-none"
              />
            )}

            <button
              onClick={submitAnswer}
              disabled={(currentQ.options ? selectedOption === null : !answer.trim()) || feedbackLoading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
            >
              {feedbackLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Answer"}
            </button>
          </div>
        )}

        {/* FEEDBACK */}
        {phase === "feedback" && feedback && (
          <div className="space-y-6">
            <div className={`rounded-xl p-6 border ${feedback.correct ? "bg-status-green/10 border-status-green/30" : "bg-destructive/10 border-destructive/30"}`}>
              <div className="flex items-center gap-2 mb-3">
                {feedback.correct ? (
                  <><CheckCircle2 className="h-5 w-5 text-status-green" /><span className="text-sm font-semibold text-status-green">Correct!</span></>
                ) : (
                  <><XCircle className="h-5 w-5 text-destructive" /><span className="text-sm font-semibold text-destructive">Not quite</span></>
                )}
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-foreground">
                {renderMath(feedback.explanation)}
              </div>
            </div>

            <button
              onClick={nextQuestion}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {currentIdx + 1 >= questions.length ? "See Results" : "Next Question"} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* RESULTS */}
        {phase === "results" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <div className="text-4xl font-bold text-foreground mb-2">{score}/{questions.length}</div>
              <p className="text-sm text-muted-foreground mb-1">{Math.round((score / questions.length) * 100)}% correct</p>
              <div className="flex items-center justify-center gap-1 text-xp mt-3">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-semibold">+{score * 10} XP</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setPhase("config"); setQuestions([]); setScore(0); setCurrentIdx(0); }}
                className="flex-1 py-3 rounded-xl bg-accent text-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
              >
                New Attack
              </button>
              <button
                onClick={() => navigate(`/track/${trackId}`)}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Back to Track
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
