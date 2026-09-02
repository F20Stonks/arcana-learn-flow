import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildRun } from "../generate";
import { isCorrect } from "../grade";
import type { Assessment, Attempt, Question, RunResult, SectionResult } from "../types";

export type RunStatus = "briefing" | "running" | "done";

export interface AssessmentApi {
  status: RunStatus;
  /** Index into the assessment's sections. */
  sectionIndex: number;
  /** Index into the current section's questions. */
  questionIndex: number;
  question: Question | null;
  input: string;
  /** Seconds left on the current section's clock. */
  remaining: number;
  /** Answered so far in this section, and right so far across the whole run. */
  answered: number;
  correct: number;
  result: RunResult | null;
  setInput: (v: string) => void;
  /** Commit the current answer and move on. There is no going back — the real thing doesn't let you. */
  submit: () => void;
  /** Move on without answering, where the real assessment allows it. */
  skip: () => void;
  start: () => void;
  /** Abandon now, keeping everything answered so far. */
  end: () => void;
  reset: () => void;
}

/**
 * One sitting of one assessment.
 *
 * Modelled on how the real things behave rather than on what would be convenient: the clock is per
 * section and runs whether or not you are looking at it, a question you leave is a question you
 * lose, and there is no going back. Those constraints are the thing being practised — an OA
 * trainer that lets you revise your answers trains a skill nobody is tested on.
 */
export function useAssessmentRun(assessment: Assessment, seed: number): AssessmentApi {
  const paper = useMemo(() => buildRun(assessment, seed), [assessment, seed]);

  const [status, setStatus] = useState<RunStatus>("briefing");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [input, setInput] = useState("");
  const [attempts, setAttempts] = useState<Attempt[][]>(() => assessment.sections.map(() => []));
  const [remaining, setRemaining] = useState(assessment.sections[0]?.seconds ?? 0);
  const [result, setResult] = useState<RunResult | null>(null);

  const sectionEndsAt = useRef(0);
  const questionStartedAt = useRef(0);
  const runStartedAt = useRef(0);
  const finished = useRef(false);

  const section = assessment.sections[sectionIndex];
  const questions = paper[sectionIndex] ?? [];
  const question = status === "running" ? (questions[questionIndex] ?? null) : null;

  const reset = useCallback(() => {
    setStatus("briefing");
    setSectionIndex(0);
    setQuestionIndex(0);
    setInput("");
    setAttempts(assessment.sections.map(() => []));
    setRemaining(assessment.sections[0]?.seconds ?? 0);
    setResult(null);
    finished.current = false;
  }, [assessment]);

  useEffect(() => reset(), [reset, seed]);

  const start = useCallback(() => {
    const now = Date.now();
    setStatus("running");
    setSectionIndex(0);
    setQuestionIndex(0);
    setInput("");
    setAttempts(assessment.sections.map(() => []));
    setRemaining(assessment.sections[0]?.seconds ?? 0);
    setResult(null);
    finished.current = false;
    sectionEndsAt.current = now + (assessment.sections[0]?.seconds ?? 0) * 1000;
    questionStartedAt.current = now;
    runStartedAt.current = now;
  }, [assessment]);

  /** Move to the next section, or end the run when there isn't one. */
  const nextSection = useCallback(() => {
    setSectionIndex((i) => {
      const next = i + 1;
      if (next >= assessment.sections.length) {
        setStatus("done");
        return i;
      }
      sectionEndsAt.current = Date.now() + assessment.sections[next].seconds * 1000;
      questionStartedAt.current = Date.now();
      setQuestionIndex(0);
      setInput("");
      setRemaining(assessment.sections[next].seconds);
      return next;
    });
  }, [assessment.sections]);

  // The section clock. Runs on its own; it does not wait for you to answer anything.
  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((sectionEndsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) nextSection();
    }, 200);
    return () => window.clearInterval(id);
  }, [status, sectionIndex, nextSection]);

  /** Record an attempt at the current question and step forward. */
  const record = useCallback(
    (given: string | null) => {
      if (status !== "running" || !question) return;
      const attempt: Attempt = {
        question,
        given,
        correct: isCorrect(question.answer, given),
        ms: Date.now() - questionStartedAt.current,
      };
      setAttempts((all) => all.map((list, i) => (i === sectionIndex ? [...list, attempt] : list)));
      setInput("");
      questionStartedAt.current = Date.now();

      if (questionIndex + 1 >= questions.length) nextSection();
      else setQuestionIndex((i) => i + 1);
    },
    [status, question, sectionIndex, questionIndex, questions.length, nextSection],
  );

  const submit = useCallback(() => {
    if (!input.trim()) return;
    record(input);
  }, [input, record]);

  const skip = useCallback(() => record(null), [record]);

  const end = useCallback(() => {
    setStatus((s) => (s === "running" ? "done" : s));
  }, []);

  // Freeze the result once, on the way into "done".
  useEffect(() => {
    if (status !== "done" || finished.current) return;
    finished.current = true;

    const sections: SectionResult[] = assessment.sections.map((s, i) => {
      const list = attempts[i] ?? [];
      return {
        section: s,
        attempts: list,
        correct: list.filter((a) => a.correct).length,
        // Everything the clock reached but nobody answered, plus everything never reached at all.
        unanswered: s.count - list.filter((a) => a.given !== null).length,
      };
    });

    const correct = sections.reduce((n, s) => n + s.correct, 0);
    const total = assessment.sections.reduce((n, s) => n + s.count, 0);
    const score = total > 0 ? correct / total : 0;
    setResult({
      assessment,
      sections,
      correct,
      total,
      score,
      passed:
        assessment.reportedPassMark === undefined ? undefined : score >= assessment.reportedPassMark,
      seconds: Math.round((Date.now() - runStartedAt.current) / 1000),
    });
  }, [status, attempts, assessment]);

  const answered = attempts[sectionIndex]?.length ?? 0;
  const correct = attempts.reduce((n, list) => n + list.filter((a) => a.correct).length, 0);

  return {
    status,
    sectionIndex,
    questionIndex,
    question,
    input,
    remaining: section ? remaining : 0,
    answered,
    correct,
    result,
    setInput,
    submit,
    skip,
    start,
    end,
    reset,
  };
}
