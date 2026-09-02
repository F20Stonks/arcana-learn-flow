import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rng } from "../rng";
import { generateQuestion } from "../generate";
import { isCorrect } from "../grade";
import { recordDrill } from "../progress";
import type { DrillConfig } from "../drill";
import type { Attempt, Question } from "../types";

export type DrillStatus = "ready" | "running" | "done";

export interface DrillApi {
  status: DrillStatus;
  index: number;
  question: Question | null;
  input: string;
  /** Null while the question is open; set the moment it is graded. */
  verdict: { correct: boolean } | null;
  attempts: Attempt[];
  correct: number;
  /** Null on an untimed drill. */
  remaining: number | null;
  setInput: (v: string) => void;
  /** Grade the current answer and hold — a drill shows you the working before moving on. */
  submit: () => void;
  next: () => void;
  start: () => void;
  end: () => void;
}

/**
 * A drill differs from a sitting in exactly one way that matters: it grades each question in front
 * of you and waits. A paper cannot do that — knowing you were wrong changes how you answer the
 * next one, which is the whole reason a real assessment withholds it. A drill is not measuring
 * you, so it should tell you at the moment you can still do something with it.
 */
export function useDrillRun(config: DrillConfig, seed: number): DrillApi {
  const questions = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: config.count }, (_, i) =>
      generateQuestion(config.kind, r, config.level, `drill-${i}`),
    );
  }, [config.kind, config.level, config.count, seed]);

  const [status, setStatus] = useState<DrillStatus>("ready");
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<{ correct: boolean } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [remaining, setRemaining] = useState<number | null>(config.seconds);

  const endsAt = useRef(0);
  const startedAt = useRef(0);
  const banked = useRef(false);

  const question = status === "running" ? (questions[index] ?? null) : null;

  const start = useCallback(() => {
    setStatus("running");
    setIndex(0);
    setInput("");
    setVerdict(null);
    setAttempts([]);
    setRemaining(config.seconds);
    banked.current = false;
    startedAt.current = Date.now();
    endsAt.current = config.seconds === null ? Infinity : Date.now() + config.seconds * 1000;
  }, [config.seconds]);

  // Changing the setup abandons whatever was arranged for the old one.
  useEffect(() => {
    setStatus("ready");
    setRemaining(config.seconds);
  }, [config.kind, config.level, config.count, config.seconds]);

  useEffect(() => {
    if (status !== "running" || config.seconds === null) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        endsAt.current = Infinity;
        setStatus("done");
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [status, config.seconds]);

  const submit = useCallback(() => {
    if (status !== "running" || !question || verdict || !input.trim()) return;
    const correct = isCorrect(question.answer, input);
    setVerdict({ correct });
    setAttempts((list) => [
      ...list,
      { question, given: input, correct, ms: Date.now() - startedAt.current },
    ]);
  }, [status, question, verdict, input]);

  const next = useCallback(() => {
    if (status !== "running") return;
    // Moving on without answering still counts the question — otherwise a drill flatters you.
    if (!verdict && question) {
      setAttempts((list) => [...list, { question, given: null, correct: false, ms: Date.now() - startedAt.current }]);
    }
    setInput("");
    setVerdict(null);
    startedAt.current = Date.now();
    if (index + 1 >= questions.length) setStatus("done");
    else setIndex((i) => i + 1);
  }, [status, verdict, question, index, questions.length]);

  const end = useCallback(() => {
    endsAt.current = Infinity;
    setStatus((s) => (s === "running" ? "done" : s));
  }, []);

  // Banked once, on the way into "done", so an abandoned drill still counts what it taught.
  useEffect(() => {
    if (status !== "done" || banked.current || attempts.length === 0) return;
    banked.current = true;
    recordDrill(attempts);
  }, [status, attempts]);

  return {
    status,
    index,
    question,
    input,
    verdict,
    attempts,
    correct: attempts.filter((a) => a.correct).length,
    remaining,
    setInput: (v) => {
      // Retyping after a verdict would let one question be graded twice.
      if (!verdict) setInput(v);
    },
    submit,
    next,
    start,
    end,
  };
}
