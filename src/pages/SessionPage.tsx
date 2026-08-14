import { getBearerToken } from "@/lib/authHeader";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowUp, Loader2, Clock, Zap, Box, AlertTriangle, CheckCircle2, Sparkles, Check, Circle, Shapes, NotebookPen, Compass, Sigma, ChevronsUpDown, SlidersHorizontal, Frame, Layers, MessageSquare, Maximize2, Minimize2 } from "lucide-react";
import "katex/dist/katex.min.css";
import { Tables } from "@/integrations/supabase/types";
import MathRenderer from "@/components/MathRenderer";
import MathTheater from "@/components/workspace/MathTheater";
import MathSymbolPalette from "@/components/MathSymbolPalette";
import RichMathField, { type RichMathFieldHandle } from "@/components/RichMathField";
import MatrixInput from "@/components/session/MatrixInput";
import NumericUnitInput from "@/components/session/NumericUnitInput";
import MultiSelectInput from "@/components/session/MultiSelectInput";
import SessionCanvas, { type ContentBounds } from "@/components/session/SessionCanvas";
import CardDeck from "@/components/session/CardDeck";
import ChatColumn from "@/components/session/ChatColumn";
import InfiniteCanvas from "@/components/session/InfiniteCanvas";
import FloatingPanel, { type PanelRect } from "@/components/session/FloatingPanel";
import NotesPanel from "@/components/session/NotesPanel";
import QuickActions from "@/components/session/QuickActions";
import NavigatorPanel, { type PlanOutline } from "@/components/session/NavigatorPanel";
import SessionSettingsPanel from "@/components/session/SessionSettingsPanel";
import PanelDock, { type DockItem } from "@/components/session/PanelDock";
import ThinkingBlock from "@/components/session/ThinkingBlock";
import {
  DEFAULT_PREFS, REVEAL_RATE, cardGap, cardWidth, loadSessionPrefs, prefsToVars, saveSessionPrefs,
  type SessionPrefs,
} from "@/lib/sessionPrefs";
import { clampScale, type Viewport } from "@/lib/canvasViewport";
import { deriveNotes } from "@/lib/sessionNotes";
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

type PanelId = "stage" | "notes" | "navigator" | "settings";
interface PanelState {
  rect: PanelRect;
  /** Folded to its title bar, still parked on the workspace. */
  collapsed: boolean;
  /** Taken off the workspace entirely — recoverable from the dock, never lost. */
  minimized: boolean;
}

const PANEL_ORDER: PanelId[] = ["stage", "notes", "navigator", "settings"];
const PANEL_META: Record<PanelId, { label: string; icon: typeof Shapes }> = {
  stage: { label: "Visualization", icon: Shapes },
  notes: { label: "Notes", icon: NotebookPen },
  navigator: { label: "Navigator", icon: Compass },
  settings: { label: "Settings", icon: SlidersHorizontal },
};

/** Which of the three arrangements the lesson itself is being read in. Orthogonal to the panel
 *  presets below: this is the shape of the CONVERSATION, those are where the tools sit. */
type CentralMode = "canvas" | "cards" | "chat";

const CENTRAL_MODES: { id: CentralMode; label: string; icon: typeof Frame; hint: string }[] = [
  { id: "canvas", label: "Canvas", icon: Frame, hint: "Free surface — drag cards anywhere, pan and zoom" },
  { id: "cards", label: "Deck", icon: Layers, hint: "One exchange at a time, scroll through the stack" },
  { id: "chat", label: "Chat", icon: MessageSquare, hint: "A plain scrolling column you can widen" },
];

/** Named arrangements of the workspace. Presets exist because the right layout for reading a long
 *  derivation is not the right layout for comparing two cards, and neither is worth arranging by
 *  hand every time. */
type ViewPreset = "read" | "study" | "overview";

const VIEW_PRESETS: { id: ViewPreset; label: string; hint: string }[] = [
  { id: "read", label: "Read", hint: "Just the lesson — panels folded away" },
  { id: "study", label: "Study", hint: "Visualization and notes alongside" },
  { id: "overview", label: "Overview", hint: "Zoom out to the whole session" },
];

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
  const { user, profile, refreshProfile } = useAuth();
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
    // Every turn ends with SOME challenge (mandatory per the tutor prompt) — most are plain
    // MCQ/scaffolding checks unrelated to this specific scene's payoff. Only a "freeform"
    // challenge (generate/predict/self-explain, loop stage 3) is actually asking the student to
    // predict what the picture will show, so only that type should gate the reveal. Locking on
    // any attached challenge over-triggered: a scene could get locked behind an MCQ that has
    // nothing to do with it, which is friction with no pedagogical payoff.
    if (extractChoices(sceneMsg.content).choices?.type !== "freeform") return false;
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

  // (Prior-exchange de-emphasis now lives in SessionCanvas, which dims every card except the live
  // one — so the old latestExchangeStart index this page used to compute is no longer needed.)
  const wantsPointAnswer = lastChoices?.type === "point" && isSceneSpec(currentPayload);
  useEffect(() => { if (!wantsPointAnswer) setAnswerPoint(null); }, [wantsPointAnswer]);

  // ---- Canvas viewport ------------------------------------------------------------------------
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [contentBounds, setContentBounds] = useState<ContentBounds | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  /** Canvas-space rects of every turn card, keyed by message index. */
  const cardRefs = useRef<Map<number, { x: number; y: number; w: number; h: number }>>(new Map());
  /** Mirror of commandBarHeight, readable by the fit maths declared above that state. */
  const commandBarHeightRef = useRef(0);

  const frameSize = () => ({
    w: frameRef.current?.clientWidth ?? window.innerWidth,
    h: frameRef.current?.clientHeight ?? window.innerHeight,
  });

  // Frame size as state as well as a getter: the maximized rect and the central column both have to
  // be recomputed when the window changes, and a plain getter can't trigger that.
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  /** Set once the student moves or resizes a panel by hand — after which the layout is theirs. */
  const panelsTouched = useRef(false);
  const placePanelsRef = useRef<(preset?: ViewPreset) => void>(() => {});
  const presetRef = useRef<ViewPreset>("study");
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let last = { w: 0, h: 0 };
    const measure = () => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      if (next.w === last.w && next.h === last.h) return;
      const first = last.w === 0;
      last = next;
      setFrame(next);
      // Panels are parked against the frame's edges. Once the frame changes size those parking
      // spots have moved, so an untouched layout is re-parked rather than left stranded — a right
      // hand panel placed at 1000px wide otherwise sits in the middle of a 1440px window, cutting
      // the reading area in half. A layout the student has arranged themselves is never overridden.
      if (!first && !panelsTouched.current) placePanelsRef.current(presetRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Student preferences (typography, density, motion, canvas) -------------------------------
  const [prefs, setPrefs] = useState<SessionPrefs>(loadSessionPrefs);
  const updatePrefs = useCallback((patch: Partial<SessionPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveSessionPrefs(next);
      return next;
    });
  }, []);
  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    saveSessionPrefs(DEFAULT_PREFS);
  }, []);
  const prefVars = useMemo(() => prefsToVars(prefs), [prefs]);
  const revealRate = REVEAL_RATE[prefs.reveal];

  // ---- How the lesson itself is laid out ------------------------------------------------------
  const [centralMode, setCentralMode] = useState<CentralMode>(() => {
    const saved = localStorage.getItem("sessionCentralMode");
    return saved === "cards" || saved === "chat" ? saved : "canvas";
  });
  const changeCentralMode = useCallback((mode: CentralMode) => {
    setCentralMode(mode);
    localStorage.setItem("sessionCentralMode", mode);
  }, []);
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = Number(localStorage.getItem("sessionChatWidth"));
    return Number.isFinite(saved) && saved >= 380 ? saved : 620;
  });
  const changeChatWidth = useCallback((w: number) => {
    setChatWidth(w);
    localStorage.setItem("sessionChatWidth", String(w));
  }, []);

  // ---- Panels ---------------------------------------------------------------------------------
  // Declared before the viewport helpers because those need to know where the right-hand panels are:
  // the reading area is whatever they aren't covering.
  const [panels, setPanels] = useState<Record<PanelId, PanelState>>(() => ({
    stage: { rect: { x: 0, y: 0, w: 340, h: 268 }, collapsed: false, minimized: false },
    notes: { rect: { x: 0, y: 0, w: 340, h: 260 }, collapsed: false, minimized: false },
    navigator: { rect: { x: 0, y: 0, w: 226, h: 300 }, collapsed: true, minimized: false },
    settings: { rect: { x: 0, y: 0, w: 268, h: 400 }, collapsed: false, minimized: true },
  }));
  const [topPanel, setTopPanel] = useState<PanelId>("stage");

  const setPanel = useCallback((id: PanelId, patch: Partial<PanelState>) => {
    // Moving or resizing by hand takes ownership of the layout: from here on the workspace stops
    // re-parking panels on a window resize, because the student has said where they want them.
    if (patch.rect) panelsTouched.current = true;
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  /** How much bottom-left room the dock is taking, so placement can stop above it. */
  const minimizedCount = PANEL_ORDER.filter((id) => panels[id].minimized).length;
  const dockAllowanceRef = useRef(0);
  dockAllowanceRef.current = minimizedCount > 0 ? 46 : 0;

  /** Which panel — or the lesson itself — is currently expanded over the workspace. */
  const [maximized, setMaximized] = useState<PanelId | "central" | null>(null);

  const toggleMaximized = useCallback((id: PanelId | "central") => {
    setMaximized((cur) => (cur === id ? null : id));
    if (id !== "central") {
      // Expanding something folded shut would show a title bar and nothing else.
      setPanels((prev) => ({ ...prev, [id]: { ...prev[id], collapsed: false, minimized: false } }));
      setTopPanel(id);
    }
  }, []);

  // Escape restores. The panel is not modal — the workspace behind it stays live — but Escape is
  // what every hand reaches for, so it has to work anyway.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximized(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const minimizePanel = useCallback((id: PanelId) => {
    setMaximized((cur) => (cur === id ? null : cur));
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], minimized: true } }));
  }, []);

  const restorePanel = useCallback((id: PanelId) => {
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], minimized: false, collapsed: false } }));
    setTopPanel(id);
  }, []);

  /**
   * Park the panels in their default corners once the frame has a real size.
   *
   * `initial` marks a placement that is allowed to decide which panels START put away. Only the
   * first placement of a session gets that say — every later call (a window resize, the dock
   * changing height) re-parks what is on the workspace without changing what the student has
   * chosen to have open.
   */
  const placePanels = useCallback((preset: ViewPreset = "study", initial = false) => {
    const { w, h } = frameSize();
    if (!w) return;
    const narrow = w < 940;
    // Below this, a left-hand panel and a right-hand column together leave the lesson itself less
    // room than either of them. The Navigator is the one that can wait in the dock: it is folded
    // shut by default anyway, so on a smaller window it costs 250px of reading width to show a
    // title bar. One click in the dock brings it straight back.
    const tight = w < 1120;
    const M = 14;
    const rightW = Math.min(340, w - M * 2);
    const rightX = narrow ? M : w - rightW - M;
    const showSide = preset === "study" && !narrow;
    // The command bar floats over the bottom of the frame, so panels stop above it rather than
    // running underneath. Placement can run before the bar has been measured, so fall back to a
    // realistic estimate — a zero here is what previously ran the notes panel off the bottom.
    const floor = h - (commandBarHeightRef.current || 210) - dockAllowanceRef.current - M;

    // The right-hand column is budgeted, not assumed. Two stacked panels at their preferred heights
    // need ~500px of frame; a 640px-tall window has nowhere near that once the command bar has taken
    // its share, and hard-coded heights there put the notes panel straight through the composer.
    const GAP = 44;
    const column = Math.max(120, floor - M);
    // The stage holds a diagram plus its caption and controls, so it gets first claim on the height.
    let stageH = narrow ? 300 : Math.min(400, Math.max(280, column * 0.5));
    stageH = Math.min(stageH, Math.max(190, column - 60));
    let notesY = M + stageH + GAP;
    let notesH = floor - notesY;
    let notesCollapsed = !showSide;
    if (notesH < 170) {
      // Not enough left for a notes panel worth reading: fold it to its title bar and rest that bar
      // on the floor, where it is still one click from opening.
      notesCollapsed = true;
      notesH = 170;
      notesY = Math.max(M + stageH + 12, floor - 42);
    }

    // Settings parks under the navigator on the left, clear of it rather than on top of it.
    const navH = Math.max(120, Math.min(320, floor - M - 60));
    const settingsY = Math.min(M + navH + 12, Math.max(M, floor - 220));
    const settingsH = Math.max(190, Math.min(430, floor - settingsY));

    setPanels((prev) => ({
      stage: {
        rect: { x: rightX, y: M, w: rightW, h: stageH },
        collapsed: preset === "read" || preset === "overview" || narrow,
        minimized: prev.stage.minimized,
      },
      notes: {
        rect: { x: rightX, y: notesY, w: rightW, h: notesH },
        collapsed: notesCollapsed,
        minimized: prev.notes.minimized,
      },
      navigator: {
        rect: { x: M, y: M, w: 226, h: navH },
        collapsed: true,
        minimized: initial ? tight : prev.navigator.minimized,
      },
      settings: {
        rect: { x: M, y: settingsY, w: 268, h: settingsH },
        collapsed: false,
        minimized: prev.settings.minimized,
      },
    }));
  }, []);

  const panelsPlaced = useRef(false);
  useEffect(() => {
    if (panelsPlaced.current) return;
    const { w } = frameSize();
    if (!w) return;
    panelsPlaced.current = true;
    placePanels("study", true);
  }, [messages.length, placePanels]);

  // The dock appearing or disappearing changes where the floor is for the left-hand panels. An
  // untouched layout follows it; a hand-arranged one is left exactly as the student left it.
  useEffect(() => {
    if (!panelsPlaced.current || panelsTouched.current) return;
    placePanels(presetRef.current);
  }, [minimizedCount, placePanels]);

  const replacedForBar = useRef(false);
  const [preset, setPreset] = useState<ViewPreset>("study");
  const applyPreset = useCallback((next: ViewPreset) => {
    setPreset(next);
    // Choosing a preset is an explicit request for a fresh arrangement, so it hands layout control
    // back to the workspace.
    panelsTouched.current = false;
    presetRef.current = next;
    placePanels(next);
    // "Overview" is a viewport state, not just a panel arrangement — fit after the panels have
    // folded, so the fit maths sees the wider reading area they just freed up.
    if (next === "overview") requestAnimationFrame(() => fitToContentRef.current());
  }, [placePanels]);
  const fitToContentRef = useRef<() => void>(() => {});
  placePanelsRef.current = placePanels;
  presetRef.current = preset;

  /**
   * The clear horizontal band between the panels — where a card can sit with nothing floating over
   * it. Computed from live panel rects rather than assumed sides, because every panel is movable:
   * whichever edge a panel has been dragged to is the edge it eats.
   *
   * Collapsed panels still count. A folded panel is still a title bar occupying that strip, and a
   * card sliding under it is exactly the overlap this exists to prevent. Minimized ones do not —
   * they are not on the workspace at all.
   */
  const clearBand = useCallback(() => {
    const { w } = frameSize();
    const mid = w / 2;
    let left = 0;
    let right = w;
    for (const id of PANEL_ORDER) {
      const p = panels[id];
      if (p.minimized) continue;
      const cx = p.rect.x + p.rect.w / 2;
      if (cx < mid) left = Math.max(left, p.rect.x + p.rect.w + 24);
      else right = Math.min(right, p.rect.x - 24);
    }
    return { left, right, w };
  }, [panels]);

  const readingBand = useCallback(() => {
    const { left, right, w } = clearBand();
    // Never let panels squeeze the reading area to nothing — below this the cards win and the
    // panels simply overlay, which beats a 40px-wide reading column. (Canvas only: cards there can
    // be dragged out from under a panel, so an overlap is recoverable.)
    if (right - left < 380) return { left: 0, right: w };
    return { left, right };
  }, [clearBand]);

  /**
   * Where the deck and the chat column live. Unlike the canvas band this one never falls back to
   * the full width: those two views place a fixed column that the student cannot drag out from
   * under a panel, so running it beneath one would be an overlap with no way out. If the clear
   * space is genuinely too narrow, the column keeps a legible minimum and stays centred in it.
   */
  const centralBand = useCallback(() => {
    const { left, right, w } = clearBand();
    const MIN = 320;
    if (right - left >= MIN) return { left, right };
    const mid = Math.min(Math.max((left + right) / 2, MIN / 2), w - MIN / 2);
    return { left: mid - MIN / 2, right: mid + MIN / 2 };
  }, [clearBand]);

  /** Frame everything on the canvas, inside the clear band and above the command bar. */
  const fitToContent = useCallback(() => {
    const b = contentBounds;
    if (!b || b.maxX <= b.minX) return;
    const { h } = frameSize();
    const { left, right } = readingBand();
    const band = right - left;
    const padX = 48;
    const padY = 64;
    const bottom = commandBarHeightRef.current + 32;
    const scale = clampScale(
      Math.min((band - padX * 2) / (b.maxX - b.minX), (h - padY - bottom) / (b.maxY - b.minY)),
    );
    setViewport({
      scale,
      x: left + (band - (b.maxX - b.minX) * scale) / 2 - b.minX * scale,
      y: padY - b.minY * scale,
    });
  }, [contentBounds, readingBand]);

  /**
   * Ease the viewport so one card sits centred in the clear band.
   *
   * If the card is wider than the band the zoom comes down to fit it, rather than centring
   * something too wide and letting its edges slide under the panels. Capped at 1 so a narrow card
   * is never magnified — this only ever zooms out to make room.
   */
  const focusRect = useCallback((r: { x: number; y: number; w: number; h: number }) => {
    const { h } = frameSize();
    const { left, right } = readingBand();
    const band = right - left;
    setViewport((vp) => {
      const scale = clampScale(Math.min(vp.scale, (band - 40) / r.w, 1));
      const targetX = left + Math.max(16, (band - r.w * scale) / 2);
      return { scale, x: targetX - r.x * scale, y: Math.max(64, h * 0.2) - r.y * scale };
    });
  }, [readingBand]);

  fitToContentRef.current = fitToContent;

  const focusCard = useCallback((index: number) => {
    const r = cardRefs.current.get(index);
    if (r) focusRect(r);
  }, [focusRect]);

  // Bring each new turn into view. Cards are placed automatically, so without this a new answer can
  // land off-screen and the session looks like it stopped responding.
  const lastFocusedRef = useRef(-1);
  useEffect(() => {
    const latest = contentBounds?.latest;
    if (!latest || messages.length === 0) return;
    if (lastFocusedRef.current === messages.length) return;
    lastFocusedRef.current = messages.length;
    focusRect(latest);
  }, [messages.length, contentBounds, focusRect]);

  const vizByMessageIndex = useMemo(() => {
    const map = new Map<number, string>();
    // Later entries win: if one turn produced two scenes, the most recent is the one its card's
    // "show on stage" button brings back.
    for (const v of vizHistory) map.set(v.messageIndex, v.id);
    return map;
  }, [vizHistory]);

  /**
   * Student-safe outline of the authored lesson plan, if one is cached for this subtopic.
   *
   * Null is the normal case, not an error: most subtopics have not been authored yet, and the
   * Navigator falls back to what it can derive locally. The endpoint returns only the core idea,
   * the derivation *claims*, notation and a checkpoint count — never the mechanisms, the
   * checkpoint evidence or the terminal problem.
   */
  const [planOutline, setPlanOutline] = useState<PlanOutline | null>(null);
  useEffect(() => {
    if (!subtopic?.title || !topic?.title || !track?.subject) return;
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/lesson-plan-outline`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getBearerToken()}` },
          body: JSON.stringify({
            subject: track.subject, level: track.level, board: track.exam_board,
            topic: topic.title, subtopic: subtopic.title,
          }),
        });
        if (!resp.ok) return;
        const body = await resp.json();
        if (!cancelled && body?.outline) setPlanOutline(body.outline as PlanOutline);
      } catch {
        /* No outline is a supported state — the Navigator simply shows less. */
      }
    })();
    return () => { cancelled = true; };
  }, [subtopic?.title, topic?.title, track?.subject, track?.level, track?.exam_board]);

  /** Everything the tutor has said, lowercased — lets the Navigator place the lesson on its route. */
  const tutorTranscript = useMemo(
    () => messages.filter((m) => m.role === "assistant").map((m) => cleanAssistantText(m.content)).join(" ").toLowerCase(),
    [messages],
  );

  /** Concise notes distilled from the tutor's turns as they arrive — no extra model call. */
  const derivedNotes = useMemo(
    () => deriveNotes(messages, cleanAssistantText),
    [messages],
  );

  /** Distinct key terms established so far, newest last — the Navigator's "Established" list. */
  const coveredTerms = useMemo(() => {
    const seen: string[] = [];
    for (const n of derivedNotes) {
      for (const t of n.terms) if (!seen.includes(t)) seen.push(t);
    }
    return seen.slice(-10);
  }, [derivedNotes]);

  const [savingNote, setSavingNote] = useState(false);
  /** Whether the composer's "/" menu is showing every quick action or just the two-chip teaser. */
  const [commandsOpen, setCommandsOpen] = useState(false);

  // The command bar floats over the canvas, and its height is NOT fixed — it swaps between a text
  // field, a matrix grid, a row of MCQ buttons and so on, and grows again when the symbol palette
  // opens. A hard-coded bottom padding is therefore guaranteed to be wrong for some turn, and being
  // wrong means the last card slides underneath the bar. Measuring it is the only way the canvas
  // can promise it never happens.
  const commandBarRef = useRef<HTMLDivElement>(null);
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  useEffect(() => {
    const el = commandBarRef.current;
    if (!el) return;
    // getBoundingClientRect over offsetHeight: offsetHeight rounds to whole pixels, and the rounding
    // error is what leaves the last card a few pixels under the bar.
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      commandBarHeightRef.current = h;
      setCommandBarHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The bar's children swap wholesale between turns (text field → MCQ buttons → matrix grid), and
    // a child that replaces another of a different height doesn't always resize the observed wrapper
    // in the same frame. Re-measuring on turn boundaries closes that gap.
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = commandBarRef.current;
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    commandBarHeightRef.current = h;
    setCommandBarHeight(h);
  }, [messages, isStreaming]);
  const canvasBottomInset = commandBarHeight + 24;

  // Re-place the panels once the command bar reports its real height: the first placement runs off
  // an estimate, and the panels that stop above the bar need the true figure or they run past it.
  useEffect(() => {
    if (replacedForBar.current || !commandBarHeight || !panelsPlaced.current) return;
    replacedForBar.current = true;
    placePanels("study", true);
  }, [commandBarHeight, placePanels]);

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

  /**
   * Pin the tutor's current explanation straight into the student's notes for this subtopic.
   *
   * The end-of-session assessment already writes its own notes, but only once, only at the end, and
   * only what it judged worth keeping. This is the student's own call, made in the moment — the
   * explanation that finally made it click is exactly the one they want back later, and it was
   * previously unrecoverable once the turn scrolled away.
   */
  const saveTurnToNotes = async (messageIndex: number) => {
    if (savingNote || !user || !subtopicId) return;
    const msg = messages[messageIndex];
    const content = msg?.role === "assistant" ? cleanAssistantText(msg.content).trim() : "";
    if (!content) {
      toast.error("Nothing to save yet");
      return;
    }
    setSavingNote(true);
    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      subtopic_id: subtopicId,
      title: subtopic?.title ? `${subtopic.title} — saved in session` : "Saved in session",
      content,
    });
    setSavingNote(false);
    if (error) {
      console.error("note save failed:", error);
      toast.error("Couldn't save that to your notes");
      return;
    }
    toast.success("Saved to your notes");
  };

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // (The transcript's scroll-following machinery — near-bottom tracking, auto-scroll on new turns,
  // "jump to latest" — retired with the scrolling transcript itself. Its canvas equivalent is
  // focusRect/focusCard above, which eases the viewport instead of scrolling a column.)

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
            learnerNotes: profile?.learner_notes || undefined,
            learnerStyleNotes: profile?.learner_style_notes || undefined,
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

  // ---- Derived layout ---------------------------------------------------------------------------
  // Everything below is computed immediately before the render and deliberately not hoisted: this
  // component declares its hooks in several passes, and a layout constant placed higher up has
  // repeatedly ended up referencing state declared further down (a temporal-dead-zone crash that has
  // bitten this file three times). Read-only derivations belong here, where every input exists.

  const framePx = { w: frame.w || window.innerWidth, h: frame.h || window.innerHeight };

  const dockItems: DockItem[] = PANEL_ORDER.filter((id) => panels[id].minimized).map((id) => ({
    id,
    label: PANEL_META[id].label,
    icon: PANEL_META[id].icon,
  }));
  // The dock is anchored to the bottom-left of the frame, so anything full-height stops above it
  // rather than running its last card through a row of pills.
  const dockAllowance = dockItems.length > 0 ? 46 : 0;
  /** The floor every floating thing stops at: above the command bar, and above the dock. */
  const floorInset = canvasBottomInset + dockAllowance;

  /** Expanded rect: most of the frame, stopping short of the command bar so it stays reachable. */
  const maxPad = Math.round(Math.min(48, Math.max(16, framePx.w * 0.04)));
  const maxRect: PanelRect = {
    x: maxPad,
    y: maxPad,
    w: Math.max(320, framePx.w - maxPad * 2),
    h: Math.max(240, framePx.h - maxPad - floorInset - 8),
  };

  /** Where the deck and the chat column sit: the clear band, or the expanded rect. */
  const band = centralBand();
  const centralRect: PanelRect =
    maximized === "central"
      ? maxRect
      : {
          x: band.left + 16,
          y: 12,
          w: Math.max(300, band.right - band.left - 32),
          h: Math.max(220, framePx.h - floorInset - 12),
        };

  /** A panel's live rect — its own, unless it's the one currently expanded. */
  const rectOf = (id: PanelId): PanelRect => (maximized === id ? maxRect : panels[id].rect);
  const zOf = (id: PanelId) => (maximized === id ? 50 : topPanel === id ? 46 : 42);

  const thinking = isStreaming && messages[messages.length - 1]?.role !== "assistant";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="h-screen flex flex-col overflow-hidden">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0">
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
          {/* View presets live in the header, not floating on the canvas — a pill in the top-right
              corner of the surface lands exactly where the stage is parked. */}
          {messages.length > 0 && (
            <>
              {/* Two switchers, deliberately separate. The left one changes the shape of the LESSON;
                  the right one changes where the TOOLS sit. Merging them into one control would
                  force a choice between the two every time either is wanted. */}
              <div className="hidden md:flex items-center gap-0.5 rounded-full border border-border/60 bg-card/60 p-0.5">
                {CENTRAL_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => changeCentralMode(m.id)}
                    title={m.hint}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors duration-200 ${
                      centralMode === m.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <m.icon className="h-3 w-3" />
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="hidden lg:flex items-center gap-0.5 rounded-full border border-border/60 bg-card/60 p-0.5">
                {VIEW_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    title={p.hint}
                    className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors duration-200 ${
                      preset === p.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  panels.settings.minimized ? restorePanel("settings") : minimizePanel("settings")
                }
                title="Session settings — typography, density, motion, canvas"
                aria-label="Session settings"
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-200 ${
                  panels.settings.minimized
                    ? "border-border/60 bg-card/60 text-muted-foreground hover:text-foreground"
                    : "border-primary/40 bg-primary/10 text-primary"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground/70"><Clock className="h-3 w-3" />{formatSessionMinutes(sessionTime)}</div>
          {xpEarned > 0 && <div className="flex items-center gap-1 text-xs text-xp"><Zap className="h-3.5 w-3.5" />+{xpEarned}</div>}
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

      {/* THE CANVAS — a real surface you pan and zoom, not a column you scroll. The visualization is
          pinned above it (StagePanel) rather than living in a card, because a diagram that scrolls
          away is useless exactly when the prose beside it starts referring to one. */}
      <div
        ref={frameRef}
        data-canvas-frame
        data-session-surface
        data-anim={prefs.animations ? "on" : "off"}
        className="relative flex-1 min-h-0"
        style={prefVars as React.CSSProperties}
      >
        {/* Backdrop shade from the student's canvas preference. Sits under everything and takes no
            pointer events, so it can never be the thing a click lands on. */}
        {prefs.tone !== 0 && (
          <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "var(--sx-tone)" }} />
        )}
          {messages.length === 0 && !isStreaming ? (
            <div className="absolute inset-0 z-10 overflow-y-auto">
              <div className="mx-auto max-w-lg px-6 pb-40 pt-[12vh] text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {subtopic?.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {isReview
                    ? <>Starting your recall review…</>
                    : <>Pick a way in, or just ask.</>}
                </p>
                {!isReview && gateLoading && !gateItems && (
                  <p className="mt-8 text-xs text-muted-foreground animate-pulse">Checking what this lesson builds on…</p>
                )}
                {!isReview && gateItems && gateItems.length > 0 && (
                  <div className="mt-8 mx-auto text-left rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-xl">
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
                  <div className="mt-8 flex flex-col items-stretch gap-2.5">
                    {STARTER_PROMPTS.map((s) => (
                      <button
                        key={s.send}
                        onClick={() => sendMessage(s.send)}
                        className="rounded-2xl border border-border/70 bg-card/70 px-5 py-3.5 text-sm text-foreground backdrop-blur-xl transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-accent hover:shadow-lg"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : centralMode === "canvas" ? (
            <InfiniteCanvas viewport={viewport} onViewportChange={setViewport} onFit={fitToContent} bottomInset={canvasBottomInset}>
              <SessionCanvas
                messages={messages}
                cleanText={cleanAssistantText}
                vizByMessageIndex={vizByMessageIndex}
                activeVizId={activeVizId}
                onSelectViz={(id) => setActiveVizId(id)}
                scale={viewport.scale}
                onBoundsChange={setContentBounds}
                cardRefs={cardRefs}
                onSaveNote={saveTurnToNotes}
                isStreaming={isStreaming}
                defaultWidth={cardWidth(prefs)}
                gap={cardGap(prefs)}
                revealRate={revealRate}
                pending={
                  thinking ? (
                    <ThinkingCard top={(contentBounds?.maxY ?? 0) + 76} width={cardWidth(prefs)} animations={prefs.animations} />
                  ) : null
                }
              />
            </InfiniteCanvas>
          ) : (
            /* Deck and chat are laid out in the clear band between the panels, so neither of them
               can ever end up underneath one. Maximizing swaps that rect for the expanded one — the
               same element, a different size, which is why it animates instead of appearing. */
            <div
              className="absolute"
              data-central={centralMode}
              style={{
                left: centralRect.x,
                top: centralRect.y,
                width: centralRect.w,
                height: centralRect.h,
                zIndex: maximized === "central" ? 50 : 10,
                transition: prefs.animations
                  ? "left 320ms var(--ease-out), top 320ms var(--ease-out), width 320ms var(--ease-out), height 320ms var(--ease-out)"
                  : "none",
              }}
            >
              <div className="flex h-full w-full flex-col">
                {/* The expand control gets its own strip. Floating it over the first card would be
                    the same mistake the visualization made. */}
                <div className="flex h-7 shrink-0 items-center justify-end gap-1 pr-1">
                  <button
                    onClick={() => toggleMaximized("central")}
                    title={maximized === "central" ? "Restore the lesson (Esc)" : "Expand the lesson"}
                    aria-label={maximized === "central" ? "Restore the lesson" : "Expand the lesson"}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {maximized === "central" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  {centralMode === "cards" ? (
                    <CardDeck
                      messages={messages}
                      cleanText={cleanAssistantText}
                      vizByMessageIndex={vizByMessageIndex}
                      activeVizId={activeVizId}
                      onSelectViz={(id) => setActiveVizId(id)}
                      onSaveNote={saveTurnToNotes}
                      isStreaming={isStreaming}
                      thinking={thinking}
                      revealRate={revealRate}
                      animations={prefs.animations}
                    />
                  ) : (
                    <ChatColumn
                      messages={messages}
                      cleanText={cleanAssistantText}
                      vizByMessageIndex={vizByMessageIndex}
                      activeVizId={activeVizId}
                      onSelectViz={(id) => setActiveVizId(id)}
                      onSaveNote={saveTurnToNotes}
                      isStreaming={isStreaming}
                      thinking={thinking}
                      revealRate={revealRate}
                      animations={prefs.animations}
                      width={Math.min(chatWidth, centralRect.w - 24)}
                      onWidthChange={changeChatWidth}
                      maxWidth={Math.max(380, centralRect.w - 24)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Dim while something is expanded. The workspace stays visible and keeps running behind
            it — this is an expansion, not a modal — but the eye is told where to look, and a click
            anywhere out there puts things back. */}
        {maximized && (
          <div
            onClick={() => setMaximized(null)}
            style={{ zIndex: 44 }}
            className="absolute inset-0 bg-background/65 backdrop-blur-[2px]"
            aria-hidden
          />
        )}

        {messages.length > 0 && (
          <>
            {/* THE STAGE — always visible, never inside a card. */}
            {!panels.stage.minimized && (
            <FloatingPanel
              rect={rectOf("stage")}
              onRectChange={(rect) => setPanel("stage", { rect })}
              collapsed={panels.stage.collapsed}
              onToggleCollapsed={() => setPanel("stage", { collapsed: !panels.stage.collapsed })}
              title={isSceneSpec(currentPayload) ? currentPayload.title : "Visualization"}
              icon={Shapes}
              side="right"
              minW={280}
              minH={200}
              zIndex={zOf("stage")}
              onFocus={() => setTopPanel("stage")}
              onMinimize={() => minimizePanel("stage")}
              maximized={maximized === "stage"}
              onToggleMaximized={() => toggleMaximized("stage")}
            >
              <MathTheater
                subtopicId={subtopicId}
                payload={pinnedInsightPayload ?? currentPayload}
                history={vizHistory}
                activeVizId={activeVizId}
                onSelectViz={(id) => setActiveVizId(id)}
                answerRequest={wantsPointAnswer ? POINT_ANSWER_KEYS : undefined}
                onAnswerChange={(x, y) => setAnswerPoint({ x, y })}
                viewingInsight={!!pinnedInsightPayload}
                onExitInsight={() => setPinnedInsightPayload(null)}
                onSelectInsight={(payload) => setPinnedInsightPayload(payload)}
                lockFinalStep={lockFinalStep}
                allowFullscreen={false}
              />
            </FloatingPanel>
            )}

            {!panels.notes.minimized && (
            <FloatingPanel
              rect={rectOf("notes")}
              onRectChange={(rect) => setPanel("notes", { rect })}
              collapsed={panels.notes.collapsed}
              onToggleCollapsed={() => setPanel("notes", { collapsed: !panels.notes.collapsed })}
              title="Notes"
              icon={NotebookPen}
              side="right"
              meta={derivedNotes.length || undefined}
              zIndex={zOf("notes")}
              onFocus={() => setTopPanel("notes")}
              onMinimize={() => minimizePanel("notes")}
              maximized={maximized === "notes"}
              onToggleMaximized={() => toggleMaximized("notes")}
            >
              <NotesPanel
                notes={derivedNotes}
                vizHistory={vizHistory}
                activeVizId={activeVizId}
                onSelectViz={(id) => setActiveVizId(id)}
                onJumpToCard={focusCard}
                isStreaming={isStreaming}
              />
            </FloatingPanel>
            )}

            {!panels.navigator.minimized && (
            <FloatingPanel
              rect={rectOf("navigator")}
              onRectChange={(rect) => setPanel("navigator", { rect })}
              collapsed={panels.navigator.collapsed}
              onToggleCollapsed={() => setPanel("navigator", { collapsed: !panels.navigator.collapsed })}
              title="Navigator"
              icon={Compass}
              side="left"
              minW={200}
              zIndex={zOf("navigator")}
              onFocus={() => setTopPanel("navigator")}
              onMinimize={() => minimizePanel("navigator")}
              maximized={maximized === "navigator"}
              onToggleMaximized={() => toggleMaximized("navigator")}
            >
              <NavigatorPanel
                topicTitle={topic?.title}
                subtopicTitle={subtopic?.title}
                prerequisites={prerequisites}
                selfExplained={selfExplained}
                covered={coveredTerms}
                turns={messages.filter((m) => m.role === "user").length}
                isReview={isReview}
                outline={planOutline}
                transcript={tutorTranscript}
              />
            </FloatingPanel>
            )}

            {!panels.settings.minimized && (
            <FloatingPanel
              rect={rectOf("settings")}
              onRectChange={(rect) => setPanel("settings", { rect })}
              collapsed={panels.settings.collapsed}
              onToggleCollapsed={() => setPanel("settings", { collapsed: !panels.settings.collapsed })}
              title="Session settings"
              icon={SlidersHorizontal}
              side="left"
              minW={244}
              minH={220}
              zIndex={zOf("settings")}
              onFocus={() => setTopPanel("settings")}
              onMinimize={() => minimizePanel("settings")}
              maximized={maximized === "settings"}
              onToggleMaximized={() => toggleMaximized("settings")}
            >
              <SessionSettingsPanel prefs={prefs} onChange={updatePrefs} onReset={resetPrefs} />
            </FloatingPanel>
            )}

            <PanelDock items={dockItems} onRestore={(id) => restorePanel(id as PanelId)} bottom={canvasBottomInset} />
          </>
        )}

        {/* COMMAND BAR — the one piece of persistent chrome. Everything the current turn needs to
            answer with lives here, so the canvas above it stays purely the lesson. */}
        {/* Lifted above the dim layer while something is expanded: the point of expanding the
            lesson is to read it and answer, so the place you answer has to stay lit. */}
        <div
          ref={commandBarRef}
          style={{ zIndex: maximized ? 52 : 30 }}
          className="pointer-events-none absolute inset-x-0 bottom-0"
        >
          <div data-command-bar className="pointer-events-auto mx-auto w-full max-w-xl px-4 pb-4">
            {/* Quick actions sit above the composer, where the eye already is when deciding what to
                say next — not floating off to one side where they read as decoration. */}
            {messages.some((m) => m.role === "assistant") && (
              <QuickActions
                onSend={sendMessage}
                disabled={isStreaming}
                expanded={commandsOpen}
                onCollapse={() => setCommandsOpen(false)}
              />
            )}
            <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card/75 shadow-[0_2px_8px_rgba(0,0,0,0.18),0_24px_56px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <InteractionPanel
                messages={messages}
                isStreaming={isStreaming}
                input={input}
                setInput={setInput}
                onSend={sendMessage}
                currentPayload={currentPayload}
                answerPoint={answerPoint}
                intensity={isReview ? undefined : intensity}
                onChangeIntensity={isReview ? undefined : changeIntensity}
                onOpenCommands={() => setCommandsOpen((v) => !v)}
              />
            </div>
          </div>
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

/**
 * The card that stands in for a reply still being composed.
 *
 * A ring of light travelling the border, plus skeleton lines with a sweep across them. It occupies
 * the same footprint the real card will, so the canvas doesn't jump when the text arrives — the
 * placeholder becomes the answer rather than being replaced by it.
 */
function ThinkingCard({ top, width, animations }: { top: number; width: number; animations: boolean }) {
  return (
    <div className={`absolute ${animations ? "animate-rise" : ""}`} style={{ left: 0, top, width }}>
      <ThinkingBlock animations={animations} />
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

// (CompletionGoal and IntensitySelector were retired with the old stacked command bar. The two
// completion conditions now live in the Navigator, where they sit beside the route they measure;
// depth became a single cycling pill in the composer instead of a permanent segmented band.)

const INTENSITY_META: Record<Intensity, { label: string; hint: string }> = {
  guided: { label: "Guided", hint: "Mostly guided choices — lowest friction." },
  balanced: { label: "Balanced", hint: "Regular self-explanation + a novel problem per idea." },
  rigorous: { label: "Rigorous", hint: "Derive and solve novel problems unaided — hardest." },
};

/** Depth is a three-position cycle in the composer rather than a permanent segmented row — it is
 *  changed rarely, so it should cost one square of chrome, not a whole band of it. */
const NEXT_INTENSITY: Record<Intensity, Intensity> = {
  guided: "balanced",
  balanced: "rigorous",
  rigorous: "guided",
};


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
  intensity,
  onChangeIntensity,
  onOpenCommands,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (text: string) => void;
  currentPayload: SimulationPayload | SceneSpec;
  answerPoint: { x: number; y: number } | null;
  intensity?: Intensity;
  onChangeIntensity?: (v: Intensity) => void;
  onOpenCommands?: () => void;
}) {
  const last = messages[messages.length - 1];
  const choices =
    last && last.role === "assistant" && !isStreaming
      ? extractChoices(last.content).choices
      : null;

  const [showText, setShowText] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
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
          <div className="p-2.5 space-y-2">
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
        <div className="p-2.5">
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

  // Composer layout: the field gets the full width of the bar, and every control sits on one quiet
  // row beneath it. The symbol palette is behind a toggle rather than permanently open — it was the
  // single biggest block of standing clutter in the old bar.
  return (
    <div className="px-3 pb-2.5 pt-2">
      <RichMathField
        ref={fieldRef}
        value={input}
        onChange={setInput}
        onEnter={() => {
          onSend(input);
          setShowText(false);
        }}
        placeholder={choices?.type === "freeform" ? "Type your answer…" : "Ask anything, or answer above…"}
        className="w-full bg-transparent px-1 py-1.5 text-[13px] text-foreground outline-hidden max-h-40 overflow-y-auto whitespace-pre-wrap break-words placeholder:text-muted-foreground/50"
        disabled={isStreaming}
        autoFocus
      />

      {showPalette && (
        <div className="mt-1.5 animate-rise">
          <MathSymbolPalette onInsert={(latex) => fieldRef.current?.insertLatex(latex)} />
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1">
        <button
          onClick={() => setShowPalette((v) => !v)}
          title="Maths symbols"
          aria-label="Maths symbols"
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-colors ${
            showPalette ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <Sigma className="h-3.5 w-3.5" />
        </button>

        {onOpenCommands && (
          <button
            onClick={onOpenCommands}
            title="Quick actions"
            aria-label="Quick actions"
            className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            /
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {intensity && onChangeIntensity && (
            <button
              onClick={() => onChangeIntensity(NEXT_INTENSITY[intensity])}
              title={`Depth: ${INTENSITY_META[intensity].hint}`}
              className="flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              {INTENSITY_META[intensity].label}
              <ChevronsUpDown className="h-3 w-3 opacity-60" />
            </button>
          )}
          <button
            onClick={() => {
              onSend(input);
              setShowText(false);
            }}
            disabled={!input.trim() || isStreaming}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-200 hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground/50"
          >
            {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
