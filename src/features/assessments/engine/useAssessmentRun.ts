/**
 * The battery state machine.
 *
 * A *battery* is the ordered list of modules a candidate actually sits — Optiver's full OA is five
 * of them — so the battery, not the module, is the unit this hook runs.
 *
 * Deliberately NOT built on src/features/drills/engine/useDrillRun.ts. That hook flashes a
 * correct/incorrect border after every answer, which is right for a practice drill and wrong here:
 * a real assessment tells you nothing until it is over. The two behaviours are load-bearing in
 * opposite directions, so they get two hooks rather than one hook with a flag.
 *
 * What carries over from useDrillRun is the timer decision, and it carries over for the same
 * reason: setInterval against a wall-clock deadline rather than requestAnimationFrame, because rAF
 * is frozen on a backgrounded tab and would silently stop the countdown for anyone who alt-tabs
 * mid-test.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssessmentItem, FirmSpec, ItemResult, ModuleSpec, RunResult, SectionResult } from "../types";
import { defaultCheck } from "./check";
import { seededRng } from "./rng";
import { scoreSection } from "./scoring";

export type RunStatus = "instructions" | "running" | "break" | "finished";

interface Answer {
  given: string;
  latencyMs: number;
}

interface UseAssessmentRunArgs {
  firm: FirmSpec;
  /** Restrict the battery to one module — the single-module practice route. */
  onlyModuleId?: string;
  /** Fixed seed reproduces the same paper. Defaults to a fresh one per run. */
  seed?: number;
}

const TICK_MS = 100;

/**
 * Items are generated for the whole section up front rather than one at a time. That makes back
 * navigation show the same item it showed before (Citadel lets you answer in any order), makes a
 * run reproducible from its seed, and lets the generator tests pin a paper and assert on it.
 */
function buildSection(module: ModuleSpec, seed: number): AssessmentItem[] {
  const rng = seededRng(seed);
  return Array.from({ length: module.itemCount }, (_, index) =>
    module.generate({ index, count: module.itemCount, rng }),
  );
}

export function useAssessmentRun({ firm, onlyModuleId, seed }: UseAssessmentRunArgs) {
  const modules = useMemo(
    () =>
      onlyModuleId
        ? firm.modules.filter((m) => m.id === onlyModuleId)
        // A full battery is the online assessment, so interview rounds are left out of it. They
        // stay individually sittable via their own route.
        : firm.modules.filter((m) => !m.interviewRound),
    [firm, onlyModuleId],
  );

  const runSeed = useMemo(() => seed ?? Math.floor(Math.random() * 2 ** 31), [seed]);

  const [status, setStatus] = useState<RunStatus>("instructions");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [items, setItems] = useState<AssessmentItem[]>([]);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [itemTimeLeftMs, setItemTimeLeftMs] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [abandoned, setAbandoned] = useState(false);

  const sectionsRef = useRef<SectionResult[]>([]);
  const answersRef = useRef<Record<number, Answer>>({});
  const itemsRef = useRef<AssessmentItem[]>([]);
  const itemIndexRef = useRef(0);
  const sectionDeadlineRef = useRef(0);
  const itemDeadlineRef = useRef(0);
  const itemStartRef = useRef(0);
  const sectionStartRef = useRef(0);
  const runStartRef = useRef(0);
  const tabBlurRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const module: ModuleSpec | undefined = modules[sectionIndex];

  /**
   * Unanswered items — reached or not — are recorded as skipped and score zero.
   *
   * Choice items are graded on the choice *id* but recorded as the *label*. On a multiple-choice
   * paper `answer` is an opaque id like "opt-2", and a debrief that told a candidate they answered
   * "opt-1" where "opt-3" was wanted would be useless — as would the same strings sitting in
   * oa_items. Grading happens first, on the id; only the record keeps what the human actually saw.
   */
  const collectResults = useCallback((mod: ModuleSpec, list: AssessmentItem[]): ItemResult[] =>
    list.map((item, index) => {
      const answer = answersRef.current[index];
      const check = mod.check ?? defaultCheck;
      const shown = (value: string) => item.choices?.find((c) => c.id === value)?.label ?? value;
      return {
        itemId: item.id,
        tag: item.tag,
        prompt: item.prompt,
        given: answer ? shown(answer.given) : "",
        expected: shown(item.answer),
        correct: answer ? check(item, answer.given) : false,
        skipped: !answer,
        latencyMs: answer?.latencyMs ?? 0,
      };
    }), []);

  const finishRun = useCallback(() => {
    setResult({
      firmId: firm.id,
      specVersion: firm.specVersion,
      sections: sectionsRef.current,
      startedAt: runStartRef.current,
      finishedAt: Date.now(),
      tabBlurCount: tabBlurRef.current,
    });
    setStatus("finished");
  }, [firm]);

  const endSection = useCallback(() => {
    clearInterval(intervalRef.current);
    const mod = modules[sectionIndex];
    if (!mod) return;
    const durationS = Math.round((Date.now() - sectionStartRef.current) / 1000);
    sectionsRef.current = [...sectionsRef.current, scoreSection(mod, collectResults(mod, itemsRef.current), durationS)];
    setStatus(sectionIndex + 1 < modules.length ? "break" : "finished");
  }, [modules, sectionIndex, collectResults]);

  // "finished" can be reached either by running out of sections or by the last section's clock,
  // so the run is sealed here rather than at each of those call sites.
  useEffect(() => {
    if (status === "finished" && !result) finishRun();
  }, [status, result, finishRun]);

  const openItem = useCallback((index: number, mod: ModuleSpec) => {
    itemIndexRef.current = index;
    setItemIndex(index);
    itemStartRef.current = performance.now();
    if (mod.perItemMs !== null) {
      itemDeadlineRef.current = Date.now() + mod.perItemMs;
      setItemTimeLeftMs(mod.perItemMs);
    } else {
      itemDeadlineRef.current = 0;
      setItemTimeLeftMs(null);
    }
  }, []);

  const advance = useCallback(() => {
    const mod = modules[sectionIndex];
    if (!mod) return;
    const next = itemIndexRef.current + 1;
    if (next >= itemsRef.current.length) {
      endSection();
      return;
    }
    openItem(next, mod);
  }, [modules, sectionIndex, endSection, openItem]);

  const tick = useCallback(() => {
    const now = Date.now();

    if (sectionDeadlineRef.current > 0) {
      const remaining = sectionDeadlineRef.current - now;
      setTimeLeftMs(Math.max(0, remaining));
      if (remaining <= 0) {
        endSection();
        return;
      }
    }

    if (itemDeadlineRef.current > 0) {
      const remaining = itemDeadlineRef.current - now;
      setItemTimeLeftMs(Math.max(0, remaining));
      // A timed-out item is left unanswered and scores zero, exactly as it would on the real test.
      if (remaining <= 0) advance();
    }
  }, [endSection, advance]);

  const beginSection = useCallback(() => {
    const mod = modules[sectionIndex];
    if (!mod) return;

    const generated = buildSection(mod, runSeed + sectionIndex * 7919);
    itemsRef.current = generated;
    setItems(generated);
    answersRef.current = {};
    setAnswers({});

    if (runStartRef.current === 0) runStartRef.current = Date.now();
    sectionStartRef.current = Date.now();
    sectionDeadlineRef.current = mod.durationS !== null ? Date.now() + mod.durationS * 1000 : 0;
    setTimeLeftMs(mod.durationS !== null ? mod.durationS * 1000 : 0);

    openItem(0, mod);
    setStatus("running");

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);
  }, [modules, sectionIndex, runSeed, openItem, tick]);

  // The interval closes over `tick`, which closes over the current section — so it is re-armed
  // whenever that changes, rather than firing a stale callback for the rest of the run.
  useEffect(() => {
    if (status !== "running") return;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [status, tick]);

  const record = useCallback((given: string) => {
    answersRef.current = {
      ...answersRef.current,
      [itemIndexRef.current]: { given, latencyMs: performance.now() - itemStartRef.current },
    };
    setAnswers(answersRef.current);
  }, []);

  const submit = useCallback(
    (given: string) => {
      if (status !== "running") return;
      record(given);
      advance();
    },
    [status, record, advance],
  );

  const skip = useCallback(() => {
    if (status !== "running" || !module?.allowSkip) return;
    advance();
  }, [status, module, advance]);

  const back = useCallback(() => {
    if (status !== "running" || !module?.allowBack) return;
    const prev = itemIndexRef.current - 1;
    if (prev < 0) return;
    openItem(prev, module);
  }, [status, module, openItem]);

  const continueToNextSection = useCallback(() => {
    setSectionIndex((i) => i + 1);
    setStatus("instructions");
  }, []);

  /**
   * Abandoning mid-run still produces a result — the sections already sat are real, and so are the
   * questions answered in the one being abandoned. That live section has to be sealed here: the
   * exit dialog promises a debrief for the questions already answered, and finishing without
   * scoring the section in progress would silently drop every one of them.
   */
  const abandon = useCallback(() => {
    clearInterval(intervalRef.current);
    const mod = modules[sectionIndex];
    if (status === "running" && mod) {
      const durationS = Math.round((Date.now() - sectionStartRef.current) / 1000);
      sectionsRef.current = [
        ...sectionsRef.current,
        scoreSection(mod, collectResults(mod, itemsRef.current), durationS),
      ];
    }
    setAbandoned(true);
    setStatus("finished");
  }, [status, modules, sectionIndex, collectResults]);

  // Tab-switching is tracked because G-Research tracks it; surfacing the count in the debrief is
  // part of replicating the experience rather than a policing mechanism.
  useEffect(() => {
    if (status !== "running") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") tabBlurRef.current += 1;
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [status]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return {
    status,
    module,
    modules,
    sectionIndex,
    itemIndex,
    item: items[itemIndex],
    items,
    answers,
    timeLeftMs,
    itemTimeLeftMs,
    result,
    /** True when the candidate walked out rather than running the clock down. */
    abandoned,
    seed: runSeed,
    /** Answered so far in this section — shown as "12 / 80", never as a score. */
    answeredCount: Object.keys(answers).length,
    beginSection,
    submit,
    skip,
    back,
    continueToNextSection,
    abandon,
  };
}
