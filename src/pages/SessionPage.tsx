import { getBearerToken } from "@/lib/authHeader";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowDown, Send, Loader2, Clock, Zap, MessageSquare, Box, AlertTriangle, CheckCircle2, Sparkles, Check, Circle } from "lucide-react";
import "katex/dist/katex.min.css";
import { Tables } from "@/integrations/supabase/types";
import MathRenderer from "@/components/MathRenderer";
import MathTheater from "@/components/workspace/MathTheater";
import MathSymbolPalette from "@/components/MathSymbolPalette";
import RichMathField, { type RichMathFieldHandle } from "@/components/RichMathField";
import MatrixInput from "@/components/session/MatrixInput";
import NumericUnitInput from "@/components/session/NumericUnitInput";
import MultiSelectInput from "@/components/session/MultiSelectInput";
import { resolveSimulationPayload, type SimulationPayload } from "@/lib/simulationPayload";
import { extractViz } from "@/lib/vizExtract";
import type { SceneSpec } from "@/lib/sceneSpec";
import { isSceneSpec } from "@/lib/sceneSpec";
import { directScene } from "@/lib/sceneDirector";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ChoiceType = "mcq" | "truefalse" | "match" | "freeform" | "numeric" | "matrix" | "point" | "multiselect";
const CHOICE_TYPES: ChoiceType[] = ["mcq", "truefalse", "match", "freeform", "numeric", "matrix", "point", "multiselect"];
type Intensity = "guided" | "balanced" | "rigorous";

// Shape returned by the assess-session edge function — the session's payoff, surfaced in the
// end-of-session summary instead of being discarded on navigate.
interface AssessSummary {
  complete: boolean;
  confidence: "low" | "medium" | "high";
  xp_earned: number;
  notes_to_save: { title: string; content: string }[];
  concepts_taught: string[];
  concepts_required: string[];
}

interface ChoiceBlock {
  type: ChoiceType;
  options: string[];
  /** Arbitrary tag attributes beyond `type` — rows/cols for matrix, answer/expectedUnit for
   * numeric, etc. Generic so a future answer shape is one new type + its own attrs, not a new
   * regex. */
  attrs: Record<string, string>;
}

function parseTagAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) attrs[m[1]] = m[2];
  return attrs;
}

function extractChoices(raw: string): { text: string; choices: ChoiceBlock | null } {
  const re = /<choices\s+([^>]*)>([\s\S]*?)<\/choices>/i;
  const m = raw.match(re);
  if (!m) return { text: raw, choices: null };
  const text = raw.replace(re, "").trim();
  const attrs = parseTagAttrs(m[1]);
  const type = (attrs.type || "").toLowerCase();
  // Unknown/malformed type — never render a broken control; fall through as if there were no
  // structured choices at all (plain freeform textarea).
  if (!CHOICE_TYPES.includes(type as ChoiceType)) return { text, choices: null };
  const body = m[2];
  const options = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  return { text, choices: { type: type as ChoiceType, options, attrs } };
}

const SCENE_REQUEST_RE = /<scene-request>\s*([\s\S]*?)\s*<\/scene-request>/i;

// Reserved param keys for the point-on-plane answer marker MathTheater splices into whatever
// scene is currently on screen. A stable module-level object so passing it as a prop never
// changes identity across renders (avoids re-triggering MathTheater's answer-report effect).
const POINT_ANSWER_KEYS = { xKey: "__ansX", yKey: "__ansY" };

function cleanAssistantText(raw: string): string {
  // strip <viz>/<scene> first, then scene requests (closed or still streaming), then <choices>
  const { text: noViz } = extractViz(raw);
  const noReq = noViz
    .replace(SCENE_REQUEST_RE, "")
    .replace(/<scene(?:-request)?>[\s\S]*$/i, "") // unclosed tag mid-stream
    .trim();
  return extractChoices(noReq).text;
}

interface VizHistoryEntry {
  id: string;
  payload: SimulationPayload | SceneSpec;
  preview: string; // short label
  messageIndex: number;
}

export default function SessionPage() {
  const { subtopicId } = useParams();
  const [searchParams] = useSearchParams();
  const isReview = searchParams.get("mode") === "review";
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [subtopic, setSubtopic] = useState<Tables<"subtopics"> | null>(null);
  const [topic, setTopic] = useState<Tables<"topics"> | null>(null);
  const [track, setTrack] = useState<Tables<"learning_tracks"> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [notes, setNotes] = useState<Tables<"notes">[]>([]);
  const [sessionTime, setSessionTime] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  // End-of-session summary from assess-session. When set, an overlay shows the outcome (completion,
  // XP, concepts banked, notes saved) before the student returns to the track.
  const [summary, setSummary] = useState<AssessSummary | null>(null);
  // Whether the student has answered a freeform (self-explanation / novel-answer) challenge at least
  // once — the one completion criterion observable client-side. Surfaced as a live goal hint so the
  // completion bar isn't a surprise at session end. (The AI still makes the authoritative verdict.)
  const [selfExplained, setSelfExplained] = useState(false);

  // Soft prerequisite nudge (framework §5): required concepts this subtopic assumes but the user
  // hasn't learned yet. A gentle heads-up, never a block. Populated in loadContext.
  const [prereqNudge, setPrereqNudge] = useState<string[] | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // Concept-graph context fed to the teaching AI: known concepts (so it can build connections) and
  // this subtopic's prerequisites with known flags (so it shores up gaps and anchors to what's known).
  const [knownConceptNames, setKnownConceptNames] = useState<string[]>([]);
  const [prerequisites, setPrerequisites] = useState<{ name: string; known: boolean }[]>([]);

  // Pre-flight prerequisite gate (failure-mode #1: never build a lesson on foundations the student
  // lacks). On a fresh session we ask the AI what 3-5 ideas/notations this subtopic ASSUMES, show them
  // as a tick-list, and feed anything left un-ticked to the teaching AI as gaps to shore up first.
  // Generated live so it works from day one, before the concept graph is populated.
  const [gateItems, setGateItems] = useState<{ name: string; note: string }[] | null>(null);
  const [gateTicks, setGateTicks] = useState<boolean[]>([]);
  const [gateLoading, setGateLoading] = useState(false);

  // Student-facing teaching intensity (persisted). Scales how hard the loop pushes self-explanation and
  // novel-problem solving; also the seam a future model-routing engine will read.
  const [intensity, setIntensity] = useState<Intensity>(() => {
    const saved = localStorage.getItem("teachingIntensity");
    return saved === "guided" || saved === "rigorous" ? saved : "balanced";
  });
  const changeIntensity = (lvl: Intensity) => {
    setIntensity(lvl);
    localStorage.setItem("teachingIntensity", lvl);
  };

  // Visualization spec history — AI emits <viz> blocks that drive the canvas
  const [vizHistory, setVizHistory] = useState<VizHistoryEntry[]>([]);
  const [activeVizId, setActiveVizId] = useState<string | null>(null);

  // Set when the student clicks a saved insight in the Math Theater's Library tab — overrides what
  // the theater displays with that static snapshot instead of the live session view, until
  // dismissed. Never affects the live teaching state (currentPayload/vizHistory) underneath.
  const [pinnedInsightPayload, setPinnedInsightPayload] = useState<SimulationPayload | SceneSpec | null>(null);

  // The currently-displayed payload — same fallback chain the Math Theater renders, hoisted here
  // so both the theater AND the point-on-plane answer control (which needs to know if a flat
  // scene is actually on screen right now) read the same value. Memoized: `resolveSimulationPayload`
  // builds a fresh object every call, and without memoizing, every 1-second session-timer re-render
  // would hand MathTheater a brand-new payload reference — which resets ALL scene params (sliders,
  // dragged points) back to defaults every second. This was a real, pre-existing bug, not just a
  // theoretical one: it would have made the new point-on-plane marker snap back to the origin
  // every second too.
  const activeVizEntry = vizHistory.find((v) => v.id === activeVizId);
  const activeViz = activeVizEntry?.payload;
  const currentPayload = useMemo(
    () => activeViz ?? resolveSimulationPayload({ subtopic, topic, track }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeViz, subtopic, topic, track],
  );

  // Predict-before-reveal gate: the Scene Director's own staging convention (sceneDirector.ts)
  // treats a staged scene's FINAL step as the payoff — the invariant/result highlighted. If the
  // assistant turn that requested this scene also posed a challenge (<choices>) the student
  // hasn't answered yet, keep that final step locked (see Scene3D's `lockFinalStep`) so the
  // picture can't confirm an answer that hasn't been committed. Structural, not a prompt ask:
  // scenes with no steps, or turns with no challenge, are completely unaffected. A pinned saved
  // insight (a static snapshot, not the live turn) is never gated.
  const lockFinalStep = useMemo(() => {
    if (pinnedInsightPayload) return false;
    if (!activeVizEntry || !isSceneSpec(activeVizEntry.payload)) return false;
    const steps = activeVizEntry.payload.steps;
    if (!steps || steps.length < 2) return false;
    const sceneMsg = messages[activeVizEntry.messageIndex];
    if (!sceneMsg || sceneMsg.role !== "assistant") return false;
    if (!extractChoices(sceneMsg.content).choices) return false;
    const answered = messages.length > activeVizEntry.messageIndex + 1;
    return !answered;
  }, [pinnedInsightPayload, activeVizEntry, messages]);

  // Live (x, y) of the point-on-plane answer marker, reported by MathTheater while the student
  // drags it. Null until the marker's first position is reported.
  const [answerPoint, setAnswerPoint] = useState<{ x: number; y: number } | null>(null);

  // Whether the tutor's last turn is asking for a point-on-plane answer AND there's actually a
  // scene on screen to place it on. Defensive: if the AI requests `point` with no scene visible
  // (it's instructed not to, but model output isn't guaranteed), this stays false and
  // InteractionPanel falls back to freeform instead of the theater rendering a broken control.
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastChoices = !isStreaming && lastAssistantMsg ? extractChoices(lastAssistantMsg.content).choices : null;

  // Index of the current exchange's start — the most recent user turn (and whatever assistant
  // reply follows it). Everything before this index is a "prior exchange" and gets visually
  // de-emphasized in the transcript (see the messages.map below). Falls back to 0 (nothing muted)
  // before any user turn exists, e.g. a review session's AI-initiated opener.
  const latestExchangeStart = messages.reduce((acc, m, idx) => (m.role === "user" ? idx : acc), 0);
  const wantsPointAnswer = lastChoices?.type === "point" && isSceneSpec(currentPayload);
  useEffect(() => { if (!wantsPointAnswer) setAnswerPoint(null); }, [wantsPointAnswer]);

  // Below the lg breakpoint, Chat and Math Theater share the screen via a toggle
  // instead of the theater being hidden outright (it used to just disappear).
  const [mobileView, setMobileView] = useState<"chat" | "theater">("chat");
  const lastSeenVizId = useRef<string | null>(null);
  useEffect(() => {
    if (mobileView === "theater") lastSeenVizId.current = activeVizId;
  }, [mobileView, activeVizId]);
  const hasUnseenViz = mobileView !== "theater" && !!activeVizId && activeVizId !== lastSeenVizId.current;

  // Desktop: resizable + minimizable Math Theater. Width is stored as a percentage
  // of the workspace and clamped so the chat panel never fully disappears.
  const [theaterMinimized, setTheaterMinimized] = useState(false);
  const [theaterWidthPct, setTheaterWidthPct] = useState(() => {
    const saved = localStorage.getItem("theaterWidthPct");
    const n = saved ? parseFloat(saved) : NaN;
    return Number.isFinite(n) ? Math.min(80, Math.max(25, n)) : 60;
  });
  useEffect(() => { localStorage.setItem("theaterWidthPct", String(theaterWidthPct)); }, [theaterWidthPct]);
  const [isResizing, setIsResizing] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const pct = ((rect.right - e.clientX) / rect.width) * 100;
      setTheaterWidthPct(Math.min(80, Math.max(25, pct)));
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizing]);

  // Virtual math keyboard dock — MathLive's on-screen keyboard defaults to a `position: fixed`
  // overlay appended to document.body, invisible to normal page layout/scroll. Pointing
  // `mathVirtualKeyboard.container` at our own element (rendered below, near the input row) makes
  // MathLive lay the keyboard out inside it instead of floating over content. `kbdHeight` (0 when
  // closed) drives the dock's own height directly — MathLive's keyboard root (`.ML__keyboard`)
  // renders its rows/toolbar as absolutely-positioned children, so it has NO natural content height
  // of its own to auto-size a wrapping block against (confirmed live: `.ML__keyboard` measures 0px
  // even once the rows are fully rendered at their real size) — a pure CSS "auto height capped by
  // max-height" approach silently stays collapsed. `mathVirtualKeyboard.boundingRect` is MathLive's
  // own public, kept-live measurement of its rows area (the "plate"); TOOLBAR_ALLOWANCE covers the
  // separate toolbar row sitting above it, measured at ~42px live, given a little headroom.
  const kbdDockRef = useRef<HTMLDivElement>(null);
  const kbdDockedRef = useRef(false);
  const [kbdHeight, setKbdHeight] = useState(0);
  const TOOLBAR_ALLOWANCE = 64;

  const syncKbdHeight = useCallback(() => {
    // Only the docked keyboard occupies layout space; the fallback overlay (iframe preview) floats.
    if (!kbdDockedRef.current) return setKbdHeight(0);
    const kbd = window.mathVirtualKeyboard;
    setKbdHeight(kbd?.visible ? Math.ceil(kbd.boundingRect.height) + TOOLBAR_ALLOWANCE : 0);
  }, []);

  useEffect(() => {
    // window.mathVirtualKeyboard doesn't exist until the first <math-field> chip has ever mounted
    // (same constraint MathSymbolPalette's own comment documents) — a fresh session's input starts
    // empty, so poll briefly instead of assuming it's already there on mount. `geometrychange` fires
    // whenever MathLive's own measurement of its rows area updates (open/close, and switching
    // layers — e.g. symbols/greek — which can change row count/height).
    let cancelled = false;
    // MathLive refuses to retarget the virtual keyboard container when the document is inside an
    // iframe (Lovable's preview) and throws "Container inside an iframe cannot be changed", which
    // took the whole page down via the error boundary. In that case just leave the keyboard as
    // MathLive's default fixed overlay — it still works, it just isn't docked.
    const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const trySetContainer = () => {
      const kbd = window.mathVirtualKeyboard;
      if (kbd && kbdDockRef.current) {
        if (!inIframe) {
          try {
            kbd.container = kbdDockRef.current;
            kbdDockedRef.current = true;
          } catch {
            /* keyboard stays as the default overlay */
          }
        }
        kbd.addEventListener("geometrychange", syncKbdHeight);
        return true;
      }
      return false;
    };
    if (trySetContainer()) return;
    const id = setInterval(() => { if (trySetContainer() || cancelled) clearInterval(id); }, 250);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.mathVirtualKeyboard?.removeEventListener("geometrychange", syncKbdHeight);
    };
  }, [syncKbdHeight]);

  useEffect(() => {
    // Catches the toggle itself (this document-level listener mirrors MathSymbolPalette's own,
    // firing after whatever handler — our button, or MathLive's own toggle inside a focused chip —
    // already ran on the same click) — geometrychange alone only fires once content is already
    // showing, not at the moment visibility flips.
    document.addEventListener("click", syncKbdHeight);
    return () => document.removeEventListener("click", syncKbdHeight);
  }, [syncKbdHeight]);

  const goBack = () => {
    // Leaving the session — however the student got here (Save & exit, End session's failure
    // fallback, the summary overlay's "Back to track") — shouldn't leave MathLive's on-screen
    // keyboard visually stuck open on whatever page loads next; nothing there necessarily has a
    // math input to reclaim it.
    window.mathVirtualKeyboard?.hide();
    const dest = topic?.track_id ? `/track/${topic.track_id}` : "/";
    navigate(dest, { replace: true });
  };

  // Explicit "leave without finishing" control (distinct from `endSession`, which grades and
  // completes the session). Every message is already written to `messages` as it's sent, and
  // `loadContext` marks the subtopic `in_progress` + resumes this exact session's transcript on
  // return — so there's genuinely nothing left to flush here. This just gives the student a
  // labeled, discoverable way to leave (replacing a bare, unlabeled back arrow) and an explicit
  // confirmation that their place is saved, instead of silent navigation with no reassurance.
  const pauseAndExit = () => {
    toast.success("Progress saved", {
      description: "Come back anytime — this session picks up right where you left off.",
    });
    goBack();
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Auto-scroll used to fire on every streamed token (any `messages` change, including the
  // in-place content update on each delta) — if a student scrolled up mid-response to re-read
  // something, the very next token yanked them back to the bottom within a second. Now it only
  // fires at turn boundaries (a message was actually ADDED, not just edited in place) and only when
  // the student is already following along near the bottom. Otherwise a small "Jump to latest"
  // affordance appears instead of forcing the scroll.
  const prevMessageCountRef = useRef(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const NEAR_BOTTOM_PX = 80;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  const jumpToLatest = () => {
    scrollToBottom();
    setShowJumpToLatest(false);
    setIsNearBottom(true);
  };

  // Track whether the student is near the bottom of the transcript so we know whether to follow
  // new content or leave them where they are.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      setIsNearBottom(nearBottom);
      if (nearBottom) setShowJumpToLatest(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // A turn boundary is a message being ADDED (length change) — not the same last message's
    // content growing token-by-token while streaming (length unchanged).
    const isNewTurn = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (!isNewTurn) return;
    if (isNearBottom) {
      scrollToBottom();
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages, isNearBottom, scrollToBottom]);

  useEffect(() => {
    timerRef.current = setInterval(() => setSessionTime((t) => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!subtopicId || !user) return;
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtopicId, user?.id]);

  // Keep the teaching context's `prerequisites` in lockstep with the gate ticks: un-ticked items are
  // flagged NOT-known so the AI shores them up first. This is the whole point of the gate.
  useEffect(() => {
    if (!gateItems) return;
    setPrerequisites(gateItems.map((it, i) => ({ name: it.name, known: !!gateTicks[i] })));
  }, [gateItems, gateTicks]);

  // Ask the (already-deployed) chat function, via systemOverride, for the prerequisites this subtopic
  // assumes. Non-teaching one-shot: we accumulate the stream and parse a small JSON list. Fails soft —
  // any error just skips the gate and the student starts as before.
  const generateGate = async (subtopicTitle: string, topicTitle: string, subj: string) => {
    setGateLoading(true);
    try {
      const sys = `You are a curriculum prerequisite analyst. A student is about to learn the subtopic "${subtopicTitle}"${topicTitle ? ` (within the topic "${topicTitle}")` : ""}${subj ? ` in ${subj}` : ""}.
List the 3-5 specific prerequisite ideas, notations, or skills this subtopic ASSUMES the student already holds — the things that, if missing, would make the lesson incomprehensible. Prefer concrete notation/terms (e.g. "the ⇒ implication arrow", "negation (¬)", "what a factor is") over broad topic names. Order them from most to least foundational.
Return ONLY a JSON object — no prose, no markdown fences:
{"prereqs":[{"name":"short label","note":"plain description, 8 words max"}]}`;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getBearerToken()}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Generate the prerequisite list now." }],
          systemOverride: sys,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("gate generation failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const d = JSON.parse(j).choices?.[0]?.delta?.content;
            if (d) acc += d;
          } catch { /* skip non-content events */ }
        }
      }

      const match = acc.match(/\{[\s\S]*\}/);
      if (match) {
        const items = (JSON.parse(match[0]).prereqs || [])
          .filter((x: { name?: string }) => x && x.name)
          .slice(0, 5)
          .map((x: { name: string; note?: string }) => ({ name: x.name, note: x.note || "" }));
        if (items.length) {
          setGateItems(items);
          setGateTicks(new Array(items.length).fill(false));
        }
      }
    } catch (e) {
      console.warn("prerequisite gate skipped:", e);
    } finally {
      setGateLoading(false);
    }
  };

  const loadContext = async () => {
    const { data: sub } = await supabase.from("subtopics").select("*").eq("id", subtopicId!).single();
    setSubtopic(sub);
    if (!sub) return;

    let trSubject = "";
    const { data: t } = await supabase.from("topics").select("*").eq("id", sub.topic_id).single();
    setTopic(t);
    if (t) {
      const { data: tr } = await supabase.from("learning_tracks").select("*").eq("id", t.track_id).single();
      setTrack(tr);
      trSubject = tr?.subject || "";
    }

    // Resume an in-progress learn session for this subtopic if one exists — its transcript is already
    // persisted in `messages`, so the student picks the teaching thread back up instead of starting cold.
    // Reviews are always fresh retrieval sessions and are never resumed.
    let activeSessionId: string | null = null;
    if (!isReview) {
      // Find this subtopic's incomplete learn sessions, then resume whichever one has the most recent
      // MESSAGE — robust against stray empty session rows (an opened-but-untouched session counts for
      // nothing, so it never shadows an older session that actually holds a transcript).
      const { data: priorSessions } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", user!.id)
        .eq("subtopic_id", subtopicId!)
        .eq("session_type", "learn")
        .is("completed_at", null);
      const priorIds = ((priorSessions || []) as { id: string }[]).map((s) => s.id);
      let priorMsgs: { role: string; content: string }[] | null = null;
      if (priorIds.length) {
        const { data: latest } = await supabase
          .from("messages")
          .select("session_id")
          .in("session_id", priorIds)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest) {
          activeSessionId = (latest as { session_id: string }).session_id;
          const { data: msgs } = await supabase
            .from("messages")
            .select("role, content")
            .eq("session_id", activeSessionId)
            .order("created_at", { ascending: true });
          priorMsgs = (msgs || []) as { role: string; content: string }[];
        }
      }
      if (activeSessionId && priorMsgs) {
        const restored = ((priorMsgs || []) as { role: string; content: string }[])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        if (restored.length) {
          setMessages(restored);
          // Restore the self-explanation flag if the transcript already holds a freeform answer.
          for (let k = 1; k < restored.length; k++) {
            if (restored[k].role === "user" && restored[k - 1].role === "assistant" &&
                extractChoices(restored[k - 1].content).choices?.type === "freeform") {
              setSelfExplained(true);
              break;
            }
          }
          // Rebuild the visualization history from restored assistant turns so the theater isn't blank.
          const restoredViz: VizHistoryEntry[] = [];
          restored.forEach((m, idx) => {
            if (m.role !== "assistant") return;
            const { viz } = extractViz(m.content);
            if (!viz) return;
            const id = `${idx}-${Math.random().toString(36).slice(2, 7)}`;
            const preview = isSceneSpec(viz) ? viz.title || "scene" : viz.labels?.abstract?.title || viz.archetype.replace("_", " ");
            // messageIndex is the assistant message's OWN index in `messages` (matches the live
            // creation sites below, where `newMessages.length` is that same index because the
            // assistant reply hasn't been appended yet at the point the entry is created) — the
            // predict-before-reveal gate above depends on `messages[entry.messageIndex]` actually
            // being this scene's originating assistant turn.
            restoredViz.push({ id, payload: viz, preview, messageIndex: idx });
          });
          if (restoredViz.length) {
            setVizHistory(restoredViz);
            setActiveVizId(restoredViz[restoredViz.length - 1].id);
          }
        }
      }
    }

    if (activeSessionId) {
      setSessionId(activeSessionId);
    } else {
      const { data: sess } = await supabase.from("sessions").insert({
        user_id: user!.id, subtopic_id: subtopicId!, session_type: isReview ? "review" : "learn",
      }).select().single();
      if (sess) setSessionId(sess.id);
    }

    if (!isReview && sub.status === "unlocked") {
      await supabase.from("subtopics").update({ status: "in_progress" }).eq("id", sub.id);
    }

    const { data: existingNotes } = await supabase.from("notes").select("*").eq("subtopic_id", subtopicId!).eq("user_id", user!.id);
    setNotes(existingNotes || []);

    // Concept-graph context for the teaching AI: the student's most-recent known concepts (used for
    // "connect in / connect out" bridges), independent of this subtopic.
    const { data: knownRows } = await supabase
      .from("user_concept_knowledge")
      .select("known_at, concepts(name)")
      .eq("user_id", user!.id)
      .order("known_at", { ascending: false })
      .limit(20);
    setKnownConceptNames(
      ((knownRows || []) as unknown as { concepts: { name: string } | null }[])
        .map((r) => r.concepts?.name)
        .filter((n): n is string => !!n),
    );

    // Prerequisite check: concepts this subtopic "requires", with known flags. Drives both the soft
    // nudge (unknown ones) and the teaching context (anchors + gaps to shore up).
    // (requires-edges are written at session completion, so this fires on re-entry and as the global
    // concept graph fills in — first-ever teaching of a subtopic simply has no requires-edges yet.)
    if (!isReview) {
      const { data: reqRows } = await supabase
        .from("subtopic_concepts")
        .select("concept_id, concepts(name)")
        .eq("subtopic_id", subtopicId!)
        .eq("role", "requires");
      const reqList = (reqRows || []) as unknown as { concept_id: string; concepts: { name: string } | null }[];
      const reqIds = reqList.map((r) => r.concept_id);
      if (reqIds.length > 0) {
        const { data: known } = await supabase
          .from("user_concept_knowledge")
          .select("concept_id")
          .eq("user_id", user!.id)
          .in("concept_id", reqIds);
        const knownSet = new Set(((known || []) as { concept_id: string }[]).map((k) => k.concept_id));
        const prereqs = reqList
          .map((r) => ({ name: r.concepts?.name || "", known: knownSet.has(r.concept_id) }))
          .filter((p) => p.name);
        setPrerequisites(prereqs);
        const unknown = prereqs.filter((p) => !p.known).map((p) => p.name);
        if (unknown.length > 0) setPrereqNudge(unknown);
      }
    }

    // Fresh learn session (not a review, not a resumed transcript) → generate the pre-flight
    // prerequisite gate so the student can flag gaps before the lesson relies on them.
    const resumed = !!activeSessionId;
    if (!isReview && !resumed) {
      generateGate(sub.title, t?.title || "", trSubject);
    }
  };

  // Active-recall review sessions open with an AI-initiated retrieval question rather than
  // waiting on the student, since they arrived here via a "review due" prompt, not their own question.
  const reviewStarted = useRef(false);
  useEffect(() => {
    if (isReview && sessionId && !reviewStarted.current) {
      reviewStarted.current = true;
      sendMessage("Let's begin the review.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReview, sessionId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming || !sessionId) return;
    // If this message is the student's answer to a freeform challenge (a self-explanation or a
    // novel-problem attempt in their own words), mark the self-explanation criterion as met.
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant && extractChoices(lastAssistant.content).choices?.type === "freeform") {
      setSelfExplained(true);
    }
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    await supabase.from("messages").insert({ session_id: sessionId, role: "user", content: text });

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getBearerToken()}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          context: {
            subtopic: subtopic?.title, topic: topic?.title,
            subject: track?.subject, level: track?.level, examBoard: track?.exam_board,
            mode: isReview ? "review" : undefined,
            reviewNotes: isReview ? notes.map((n) => `- ${n.title}: ${n.content}`).join("\n") : undefined,
            intensity,
            knownConcepts: knownConceptNames,
            prerequisites,
          },
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (assistantContent) {
        const { data: savedMsg } = await supabase
          .from("messages")
          .insert({ session_id: sessionId, role: "assistant", content: assistantContent })
          .select("id")
          .single();
        const { viz } = extractViz(assistantContent);
        if (viz) {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const preview = isSceneSpec(viz)
            ? viz.title || "scene"
            : viz.labels?.abstract?.title || viz.archetype.replace("_", " ");
          setVizHistory((prev) => [
            ...prev,
            { id, payload: viz, preview, messageIndex: newMessages.length },
          ]);
          setActiveVizId(id);
        }

        // Scene-request path: the tutor asked the Scene Director for a scene
        // instead of authoring one inline. Fire it without blocking the turn;
        // the canvas updates (and the message row gains the <scene> JSON so
        // reloads rebuild it) whenever the director returns.
        const reqMatch = assistantContent.match(SCENE_REQUEST_RE);
        if (!viz && reqMatch) {
          const recent = newMessages
            .slice(-2)
            .map((m) => `${m.role}: ${cleanAssistantText(m.content).slice(0, 400)}`)
            .join("\n");
          void (async () => {
            const scene = await directScene({
              request: reqMatch[1].trim(),
              subject: track?.subject,
              topic: topic?.title,
              subtopic: subtopic?.title,
              level: track?.level ?? undefined,
              recentTranscript: recent,
            });
            if (!scene) return;
            const id = `${Date.now()}-dir`;
            setVizHistory((prev) => [
              ...prev,
              { id, payload: scene, preview: scene.title || "scene", messageIndex: newMessages.length },
            ]);
            setActiveVizId(id);
            const updatedContent = `${assistantContent}\n<scene>${JSON.stringify(scene)}</scene>`;
            if (savedMsg?.id) {
              await supabase.from("messages").update({ content: updatedContent }).eq("id", savedMsg.id);
            }
            // Also patch local `messages` state — the AI's context for the NEXT turn is built from
            // this, not the DB row. Without this, the tutor never sees the scene it just asked for
            // (and can't grade a point-on-plane answer against a frame it doesn't know) until the
            // page is reloaded, which rebuilds from the DB. Match by content, not index/reference:
            // the director call is fire-and-forget and the student may have sent another message
            // (and `isStreaming` reset to false) before this resolves.
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.role === "assistant" && m.content === assistantContent);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = { ...updated[idx], content: updatedContent };
              return updated;
            });
          })();
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const endSession = async () => {
    if (isEnding) return;
    // Nothing was exchanged — no transcript to grade, so skip the assessment call and just leave.
    if (!sessionId || messages.length === 0) {
      goBack();
      return;
    }
    setIsEnding(true);
    try {
      // assess-session is the completion pipeline: it grades the session, extracts + tags concepts,
      // grants concept knowledge, schedules/advances reviews, marks the subtopic complete, and awards
      // XP — all server-side with the service role. The client just triggers it and refreshes the UI.
      const resp = await supabase.functions.invoke("assess-session", {
        body: { sessionId, subtopicId, messages, intensity },
      });
      if (resp.data) {
        const d = resp.data as AssessSummary;
        setXpEarned(d.xp_earned || 0);
        // A profile-refresh hiccup shouldn't cost the student their session summary.
        try { await refreshProfile(); } catch { /* non-fatal — summary still shows */ }
        setIsEnding(false);
        setSummary(d); // hold on the page; the summary overlay's button navigates back
        return;
      }
      throw new Error("assessment returned no data");
    } catch {
      // Network/function failure: best-effort close the session row so it isn't left dangling,
      // then leave — we have no verdict to summarize.
      try { await supabase.from("sessions").update({ completed_at: new Date().toISOString() }).eq("id", sessionId); } catch { /* nothing more we can do */ }
      setIsEnding(false);
      goBack();
    }
  };

  // Saving a visualization is the STUDENT's call, made explicitly at session end — never an AI
  // decision about which scenes "mattered". `payload` isn't in the generated types yet (see
  // supabase/migrations/20260727180000_insights_payload.sql), cast like other not-yet-typed tables.
  const saveVizAsInsight = async (entry: VizHistoryEntry): Promise<string | null> => {
    if (!user) return null;
    const scene = isSceneSpec(entry.payload);
    const { data, error } = await (supabase.from("insights") as any)
      .insert({
        user_id: user.id,
        subtopic_id: subtopicId ?? null,
        title: entry.preview,
        environment: scene ? "scene" : (entry.payload as SimulationPayload).archetype,
        mode: "pure",
        formulas: [],
        params: {},
        payload: entry.payload,
      })
      .select()
      .single();
    if (error) { console.error("Couldn't save visualization:", error); return null; }
    return (data as { id: string } | null)?.id ?? null;
  };

  const removeVizInsight = async (insightId: string) => {
    await (supabase.from("insights") as any).delete().eq("id", insightId);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Coarser, minute-granularity readout for the header's peripheral timer (below) — deliberately
  // less precise than `formatTime`'s mm:ss (still used for the end-of-session summary, a one-time
  // static display where the extra precision is fine) so the visible text only changes once a
  // minute instead of ticking every second in the corner of the eye. `sessionTime` itself is
  // untouched and still updates every second underneath — this only throttles what's rendered.
  const formatSessionMinutes = (s: number) => {
    const mins = Math.floor(s / 60);
    return mins < 1 ? "<1 min" : `${mins} min`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-screen flex flex-col overflow-hidden">
      <header className="border-b border-border bg-background px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={pauseAndExit}
            title="Save & exit — your progress is saved and this session can be resumed later"
            aria-label="Save and exit session"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Save &amp; exit</span>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
              {subtopic?.title}
              {isReview && <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-warning/15 text-warning">Review</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">{topic?.title} · {track?.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Demoted from a ticking mm:ss to a minute-granularity readout — CompletionGoal (in the
              transcript panel below) is the primary ambient "how much is left" signal now; this is
              just a quiet peripheral reference, not something that should visibly move every second. */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground/70"><Clock className="h-3 w-3" />{formatSessionMinutes(sessionTime)}</div>
          {xpEarned > 0 && <div className="flex items-center gap-1 text-xs text-xp"><Zap className="h-3.5 w-3.5" />+{xpEarned}</div>}
          <div className="lg:hidden flex items-center gap-0.5 bg-accent rounded-lg p-0.5">
            <button
              onClick={() => setMobileView("chat")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${mobileView === "chat" ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Chat
            </button>
            <button
              onClick={() => setMobileView("theater")}
              className={`relative px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${mobileView === "theater" ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              <Box className="h-3.5 w-3.5" /> Theater
              {hasUnseenViz && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
            </button>
          </div>
          <button onClick={endSession} disabled={isEnding} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {isEnding && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEnding ? "Ending…" : "End"}
          </button>
        </div>
      </header>

      {!isReview && prereqNudge && !nudgeDismissed && (
        <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 sm:px-6 py-2.5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-foreground flex-1 leading-snug">
            This builds on <strong className="font-medium">{prereqNudge.slice(0, 3).join(", ")}</strong>
            {prereqNudge.length > 3 ? `, +${prereqNudge.length - 3} more` : ""}, which you haven't covered yet.
            You can carry on, or review those first.
          </p>
          <button onClick={() => setNudgeDismissed(true)} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <div ref={workspaceRef} className={`flex-1 flex min-h-0 ${isResizing ? "select-none" : ""}`}>
        {/* LEFT — Companion Panel */}
        <div
          className={`min-h-0 border-r border-border flex-col ${mobileView === "chat" ? "flex" : "hidden"} lg:flex`}
          style={{ flex: `1 1 ${theaterMinimized ? "100%" : `${100 - theaterWidthPct}%`}` }}
        >
          <div className="relative flex-1 min-h-0">
          <div ref={chatScrollRef} className="h-full overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">
                  {isReview
                    ? <>Starting your recall review of <strong className="text-foreground">{subtopic?.title}</strong>…</>
                    : <>Start your session on <strong className="text-foreground">{subtopic?.title}</strong> — pick a way in, or just ask.</>}
                </p>
                {!isReview && gateLoading && !gateItems && (
                  <p className="mt-6 text-xs text-muted-foreground animate-pulse">Checking what this lesson builds on…</p>
                )}
                {!isReview && gateItems && gateItems.length > 0 && (
                  <div className="mt-6 max-w-sm mx-auto text-left rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs font-semibold text-foreground">Before we start — tick what you're already solid on</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">Anything you leave unticked, I'll build up first so nothing catches you out.</p>
                    <div className="flex flex-col gap-1">
                      {gateItems.map((it, i) => (
                        <label
                          key={i}
                          className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-accent transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={gateTicks[i] || false}
                            onChange={() => setGateTicks((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                          />
                          <span className="text-sm text-foreground leading-tight">
                            {it.name}
                            {it.note && <span className="block text-[11px] text-muted-foreground">{it.note}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {!isReview && (
                  <div className="mt-5 flex flex-col items-stretch gap-2 max-w-xs mx-auto">
                    {STARTER_PROMPTS.map((s) => (
                      <button
                        key={s.send}
                        onClick={() => sendMessage(s.send)}
                        className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground hover:bg-accent hover:border-primary/40 transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const text = isUser ? msg.content : cleanAssistantText(msg.content);
              // Information hierarchy, not decoration: turns from before the current exchange (the
              // most recent user message and its reply) fade to a lower visual weight as the
              // transcript grows over a long session, so the student's eye lands on what's active
              // right now. Nothing is hidden or removed — still fully visible and scrollable-to.
              const isPriorExchange = i < latestExchangeStart;
              return (
                <div
                  key={i}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} transition-opacity duration-300 ${isPriorExchange ? "opacity-55" : ""}`}
                >
                  <div
                    className={
                      isUser
                        ? "max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-primary text-primary-foreground"
                        : "max-w-[90%] sm:max-w-[80%] text-sm leading-relaxed text-foreground"
                    }
                  >
                    <MathRenderer content={text} />
                  </div>
                </div>
              );
            })}
            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Unobtrusive re-entry point when a student has scrolled up to re-read something mid-
              response — the transcript no longer force-scrolls to find them, so this is the only
              way back to the live edge. Disappears the moment they're back near the bottom. */}
          {showJumpToLatest && (
            <button
              onClick={jumpToLatest}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md hover:bg-accent transition-colors animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
            </button>
          )}
          </div>

          {!isReview && messages.length > 0 && <CompletionGoal selfExplained={selfExplained} />}
          {!isReview && <IntensitySelector intensity={intensity} onChange={changeIntensity} />}

          <InteractionPanel
            messages={messages}
            isStreaming={isStreaming}
            input={input}
            setInput={setInput}
            onSend={sendMessage}
            currentPayload={currentPayload}
            answerPoint={answerPoint}
          />
        </div>

        {/* Resize handle */}
        {!theaterMinimized && (
          <div
            className="hidden lg:block w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
            onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
            title="Drag to resize"
          />
        )}

        {/* RIGHT — Math Theater */}
        <div
          className={`min-h-0 flex-col ${mobileView === "theater" ? "flex" : "hidden"} lg:flex`}
          style={{ flex: `0 0 ${theaterMinimized ? "3rem" : `${theaterWidthPct}%`}` }}
        >
          <MathTheater
            subtopicId={subtopicId}
            payload={pinnedInsightPayload ?? currentPayload}
            history={vizHistory}
            activeVizId={activeVizId}
            onSelectViz={(id) => setActiveVizId(id)}
            minimized={theaterMinimized}
            onMinimize={() => setTheaterMinimized(true)}
            onRestore={() => setTheaterMinimized(false)}
            answerRequest={wantsPointAnswer ? POINT_ANSWER_KEYS : undefined}
            onAnswerChange={(x, y) => setAnswerPoint({ x, y })}
            viewingInsight={!!pinnedInsightPayload}
            onExitInsight={() => setPinnedInsightPayload(null)}
            onSelectInsight={(payload) => setPinnedInsightPayload(payload)}
            lockFinalStep={lockFinalStep}
          />
        </div>
      </div>
      </div>

      {/* MathLive's on-screen keyboard renders INSIDE this dock (see the container-assignment
          effect above) instead of as a fixed viewport overlay — collapsed to zero height (not
          display:none, so MathLive's own layout/geometry reads still resolve correctly) when
          hidden, so the page above is exactly one viewport tall and the toggle button never needs
          scrolling to find. Opening it grows the PAGE downward in normal flow: scroll down to reach
          the keyboard, scroll back up to see the chat + Math Theater with the keyboard just out of
          view (rather than a disconnected overlay that can cover or orphan other UI). */}
      <div
        ref={kbdDockRef}
        className="shrink-0 overflow-hidden transition-[height] duration-300 ease-in-out bg-card border-t border-border"
        style={{ height: `${kbdHeight}px` }}
      />

      {summary && (
        <SessionSummary
          summary={summary}
          isReview={isReview}
          subtopicTitle={subtopic?.title}
          sessionTime={formatTime(sessionTime)}
          onClose={goBack}
          vizHistory={vizHistory}
          onSaveViz={saveVizAsInsight}
          onRemoveViz={removeVizInsight}
        />
      )}
    </div>
  );
}

const CONFIDENCE_META: Record<AssessSummary["confidence"], { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "bg-success/15 text-success" },
  medium: { label: "Medium confidence", cls: "bg-warning/15 text-warning" },
  low: { label: "Low confidence", cls: "bg-muted text-muted-foreground" },
};

function SessionSummary({
  summary,
  isReview,
  subtopicTitle,
  sessionTime,
  onClose,
  vizHistory,
  onSaveViz,
  onRemoveViz,
}: {
  summary: AssessSummary;
  isReview: boolean;
  subtopicTitle?: string;
  sessionTime: string;
  onClose: () => void;
  vizHistory: VizHistoryEntry[];
  onSaveViz: (entry: VizHistoryEntry) => Promise<string | null>;
  onRemoveViz: (insightId: string) => Promise<void>;
}) {
  const { complete, confidence, xp_earned, notes_to_save, concepts_taught } = summary;
  const conf = CONFIDENCE_META[confidence] ?? CONFIDENCE_META.low;
  const heading = complete ? (isReview ? "Recall confirmed" : "Subtopic complete") : "Progress saved";

  // entryId -> the insights.id it was saved as, once saved. Nothing pre-checked — the student
  // picks, the AI never decides "which scenes mattered" on their behalf.
  const [savedInsightIds, setSavedInsightIds] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const toggleViz = async (entry: VizHistoryEntry) => {
    setSavingId(entry.id);
    const existing = savedInsightIds[entry.id];
    if (existing) {
      await onRemoveViz(existing);
      setSavedInsightIds((prev) => { const next = { ...prev }; delete next[entry.id]; return next; });
    } else {
      const insightId = await onSaveViz(entry);
      if (insightId) setSavedInsightIds((prev) => ({ ...prev, [entry.id]: insightId }));
    }
    setSavingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className={`px-6 py-5 flex items-center gap-3 ${complete ? "bg-success/10" : "bg-accent"}`}>
          {complete
            ? <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
            : <Sparkles className="h-8 w-8 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground leading-tight">{heading}</h2>
            {subtopicTitle && <p className="text-sm text-muted-foreground truncate">{subtopicTitle}</p>}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xp font-semibold"><Zap className="h-4 w-4" />+{xp_earned} XP</div>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${conf.cls}`}>{conf.label}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{sessionTime}</span>
          </div>

          {!complete && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isReview
                ? "Not every recall check landed this time, so this stays on your review schedule — you'll get another pass at it soon."
                : "Cortexed marks a subtopic complete once you've explained the why in your own words and solved a novel problem largely unaided. Your progress and XP are saved — pick this back up whenever you like."}
            </p>
          )}

          {complete && !isReview && concepts_taught.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Concepts banked</p>
              <div className="flex flex-wrap gap-1.5">
                {concepts_taught.map((c, i) => (
                  <span key={i} className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">{c}</span>
                ))}
              </div>
            </div>
          )}

          {complete && notes_to_save.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Saved to your notes</p>
              <ul className="space-y-1">
                {notes_to_save.map((n, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span className="leading-snug">{n.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vizHistory.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Save a visualization to your notes?
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {vizHistory.map((v) => {
                  const saved = !!savedInsightIds[v.id];
                  const busy = savingId === v.id;
                  return (
                    <label
                      key={v.id}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer hover:border-primary/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={saved}
                        disabled={busy}
                        onChange={() => toggleViz(v)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-border text-primary focus:ring-primary"
                      />
                      <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">{v.preview}</span>
                      {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to track
          </button>
        </div>
      </div>
    </div>
  );
}

// First-turn on-ramps for a cold session so the student never faces a blank "ask anything" prompt.
const STARTER_PROMPTS: { label: string; send: string }[] = [
  { label: "Teach me from the start", send: "Teach me this from the start." },
  { label: "I'm shaky — go slow", send: "I'm shaky on the basics here — go slow and build up carefully." },
  { label: "Skip ahead and quiz me", send: "I think I know this — skip ahead and quiz me to find my gaps." },
];

// A concept is only marked complete once the student explains a 'why' in their own words AND solves a
// novel problem unaided. Showing the bar mid-session keeps "Progress saved" from being a surprise. Only
// the self-explanation half is observable client-side; the novel-problem half is the AI's call at the end.
function CompletionGoal({ selfExplained }: { selfExplained: boolean }) {
  return (
    <div className="px-4 pt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
      <span className="shrink-0 font-medium">To complete:</span>
      <span className={`flex items-center gap-1 ${selfExplained ? "text-success" : ""}`}>
        {selfExplained ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
        explain a “why” in your own words
      </span>
      <span className="flex items-center gap-1">
        <Circle className="h-3 w-3" />
        solve a novel problem unaided
      </span>
    </div>
  );
}

const INTENSITY_META: Record<Intensity, { label: string; hint: string }> = {
  guided: { label: "Guided", hint: "Mostly guided choices — lowest friction." },
  balanced: { label: "Balanced", hint: "Regular self-explanation + a novel problem per idea." },
  rigorous: { label: "Rigorous", hint: "Derive and solve novel problems unaided — hardest." },
};

function IntensitySelector({ intensity, onChange }: { intensity: Intensity; onChange: (v: Intensity) => void }) {
  return (
    <div className="px-4 pt-2 pb-1 flex items-center gap-2 border-t border-border">
      <span
        className="text-[11px] text-muted-foreground shrink-0"
        title="How hard Cortexed pushes you to explain the why and solve novel problems yourself"
      >
        Depth
      </span>
      <div className="flex items-center gap-0.5 bg-accent rounded-lg p-0.5">
        {(Object.keys(INTENSITY_META) as Intensity[]).map((lvl) => (
          <button
            key={lvl}
            onClick={() => onChange(lvl)}
            title={INTENSITY_META[lvl].hint}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              intensity === lvl ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {INTENSITY_META[lvl].label}
          </button>
        ))}
      </div>
    </div>
  );
}

// 1-4 inclusive for both dims — matches the bound MathSymbolPalette's own templates use (2x2,
// 2-vector). Returns null (not NaN) on anything out of range so callers can treat it as "invalid,
// fall back to freeform" with a single falsy check.
function clampGridDim(raw: string | undefined): number | null {
  const n = parseInt(raw ?? "", 10);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
}

function InteractionPanel({
  messages,
  isStreaming,
  input,
  setInput,
  onSend,
  currentPayload,
  answerPoint,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
  currentPayload: SimulationPayload | SceneSpec;
  answerPoint: { x: number; y: number } | null;
}) {
  const last = messages[messages.length - 1];
  const choices =
    last && last.role === "assistant" && !isStreaming
      ? extractChoices(last.content).choices
      : null;

  const [showText, setShowText] = useState(false);
  const fieldRef = useRef<RichMathFieldHandle>(null);

  // A fresh structured prompt should never inherit the previous turn's "type instead" escape.
  useEffect(() => { setShowText(false); }, [choices?.type]);

  if (choices && !showText) {
    if (choices.type === "matrix") {
      const rows = clampGridDim(choices.attrs.rows);
      const cols = clampGridDim(choices.attrs.cols);
      // Defensive: bad/missing rows|cols, or no embedded answer to check against — never render a
      // broken grid, fall through to the plain textarea below instead.
      if (rows && cols && choices.attrs.answer) {
        return (
          <MatrixInput
            rows={rows}
            cols={cols}
            expectedAnswer={choices.attrs.answer}
            disabled={isStreaming}
            onSend={onSend}
            onEscape={() => setShowText(true)}
          />
        );
      }
    } else if (choices.type === "numeric") {
      if (choices.attrs.answer) {
        return (
          <NumericUnitInput
            withUnit={choices.attrs.unit === "true"}
            expectedValue={choices.attrs.answer}
            expectedUnit={choices.attrs.expectedUnit ?? ""}
            disabled={isStreaming}
            onSend={onSend}
            onEscape={() => setShowText(true)}
          />
        );
      }
    } else if (choices.type === "multiselect") {
      if (choices.options.length > 0) {
        return (
          <MultiSelectInput
            options={choices.options}
            disabled={isStreaming}
            onSend={onSend}
            onEscape={() => setShowText(true)}
          />
        );
      }
    } else if (choices.type === "point") {
      // Only when a flat scene is actually visible right now — otherwise there's nothing to drag
      // a marker onto, so fall through to freeform (the AI is instructed not to request `point`
      // without a scene on screen, but model output isn't guaranteed).
      if (isSceneSpec(currentPayload)) {
        const x = answerPoint?.x ?? 0;
        const y = answerPoint?.y ?? 0;
        return (
          <div className="p-4 border-t border-border space-y-2">
            <p className="text-sm text-muted-foreground">
              Drag the highlighted point on the Math Theater into place, then submit.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSend(`Placed the point at (${x.toFixed(2)}, ${y.toFixed(2)}) on "${currentPayload.title}".`)}
                disabled={isStreaming}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                Submit point
              </button>
              <button onClick={() => setShowText(true)} className="text-xs text-muted-foreground hover:text-foreground">
                Type instead →
              </button>
            </div>
          </div>
        );
      }
    } else if (choices.options.length > 0 && choices.type !== "freeform") {
      return (
        <div className="p-4 border-t border-border bg-background">
          <div className="flex flex-wrap gap-2 mb-2">
            {choices.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => onSend(opt)}
                disabled={isStreaming}
                className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground hover:bg-accent hover:border-primary/40 transition-colors text-left leading-snug disabled:opacity-40"
              >
                <MathRenderer content={opt} />
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowText(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Type instead →
          </button>
        </div>
      );
    }
  }

  return (
    <div className="p-4 border-t border-border space-y-2">
      <MathSymbolPalette onInsert={(latex) => fieldRef.current?.insertLatex(latex)} />
      <div className="flex items-end gap-3 bg-card border border-border rounded-xl px-4 py-2.5">
        <RichMathField
          ref={fieldRef}
          value={input}
          onChange={setInput}
          onEnter={() => {
            onSend(input);
            setShowText(false);
          }}
          placeholder={choices?.type === "freeform" ? "Type your answer…" : "Ask Cortexed…"}
          className="flex-1 bg-transparent text-sm text-foreground outline-hidden max-h-40 overflow-y-auto py-1 whitespace-pre-wrap break-words"
          disabled={isStreaming}
          autoFocus
        />
        <button
          onClick={() => {
            onSend(input);
            setShowText(false);
          }}
          disabled={!input.trim() || isStreaming}
          className="h-8 w-8 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
