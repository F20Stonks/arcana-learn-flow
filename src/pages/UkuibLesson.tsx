/**
 * The lesson player.
 *
 * Runs outside AppShell, full-bleed, with its own chrome — a progress bar, five hearts and a way
 * out, and nothing else. That is deliberate and it is the whole point of a session surface: for
 * the three minutes a lesson lasts, the only thing on screen should be the question. The reader
 * precedent is ResourceReader, which drops the sidebar for the same reason.
 *
 * Every exercise type renders here and grades through `useUkuibLesson`, which in turn grades
 * through the same `answer.ts` the rest of the app uses. Nothing about correctness is decided in
 * this file.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, Crown, Heart, Lightbulb, RotateCcw, X } from "lucide-react";
import Tex from "@/features/integrals/components/Tex";
import AnswerInput from "@/features/integrals/components/AnswerInput";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import { integralLatex } from "@/features/integrals/latex";
import { PROBLEM_BY_ID } from "@/features/integrals/problems";
import { TECHNIQUE_BY_ID } from "@/features/integrals/techniques";
import { useUkuibLesson } from "@/features/integrals/hooks/useUkuibLesson";
import { SKILL_BY_ID } from "@/features/integrals/ukuib/curriculum";
import { HEARTS_PER_LESSON } from "@/features/integrals/ukuib/lesson";
import type { Exercise, ExerciseResponse } from "@/features/integrals/ukuib/exercises";
import type { TechniqueId } from "@/features/integrals/types";

// ── chrome ─────────────────────────────────────────────────────────────────────────────────────

function Hearts({ left }: { left: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${left} hearts left`}>
      {Array.from({ length: HEARTS_PER_LESSON }, (_, i) => (
        <Heart
          key={i}
          className={`h-4 w-4 transition-all duration-300 ${
            i < left
              ? "fill-[var(--status-red)] text-[var(--status-red)] drop-shadow-[0_0_6px_color-mix(in_oklab,var(--status-red)_60%,transparent)]"
              : "scale-90 text-border"
          }`}
        />
      ))}
    </div>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-accent">
      <div
        className="relative h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: `${pct}%`,
          boxShadow: "0 0 16px -2px color-mix(in oklab, var(--primary) 80%, transparent)",
        }}
      >
        <span className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-[color-mix(in_oklab,white_28%,transparent)]" />
      </div>
    </div>
  );
}

/** The tappable card shape every multiple-choice option uses. */
function OptionButton({
  selected,
  locked,
  state,
  onClick,
  children,
}: {
  selected: boolean;
  locked: boolean;
  /** After grading: was this option the right one, the one picked, or neither. */
  state: "none" | "right" | "wrong";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tone =
    state === "right"
      ? "border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-foreground"
      : state === "wrong"
        ? "border-[var(--status-red)] bg-[color-mix(in_oklab,var(--status-red)_12%,transparent)] text-foreground"
        : selected
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-foreground hover:border-primary/45";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={`glass-card w-full rounded-2xl border px-4 py-4 text-left text-[15px] transition-all disabled:cursor-default ${tone}`}
    >
      {children}
    </button>
  );
}

// ── exercise bodies ────────────────────────────────────────────────────────────────────────────

function TeachCard({ ex }: { ex: Extract<Exercise, { kind: "teach" }> }) {
  const t = TECHNIQUE_BY_ID[ex.technique];
  if (!t) return null;
  const example = (t.examples ?? [t.example])[ex.exampleIndex] ?? t.example;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="micro-label">The idea</p>
        <h2 className="font-display mt-1.5 text-[23px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          {t.name}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          <Tex>{t.tagline}</Tex>
        </p>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:p-5">
        <p className="micro-label mb-2 text-primary">When to reach for it</p>
        <p className="text-[14.5px] leading-relaxed text-foreground">
          <Tex>{t.whenToUse}</Tex>
        </p>
      </div>

      {t.intuition && (
        <div>
          <p className="micro-label mb-2">Why it works</p>
          <p className="text-[14.5px] leading-relaxed text-muted-foreground">
            <Tex>{t.intuition}</Tex>
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="micro-label mb-3">Worked example</p>
        <div className="overflow-x-auto py-1 text-center">
          <Tex block>{`\\int ${example.integrand}\\,dx`}</Tex>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {example.work.map((line, i) => (
            <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted-foreground">
              <span className="readout shrink-0 text-primary">{i + 1}</span>
              <span className="min-w-0 overflow-x-auto">
                <Tex>{line}</Tex>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 border-t border-border pt-3 text-center">
          <Tex block>{example.result}</Tex>
        </div>
      </div>
    </div>
  );
}

function RecogniseBody({
  ex,
  choice,
  setChoice,
  answered,
}: {
  ex: Extract<Exercise, { kind: "recognise" }>;
  choice: string | null;
  setChoice: (v: string) => void;
  answered: boolean;
}) {
  const problem = PROBLEM_BY_ID[ex.problemId];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="micro-label">Which technique cracks this?</p>
        <div className="mt-4 overflow-x-auto py-3 text-center">
          {problem && <Tex block>{integralLatex(problem)}</Tex>}
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ex.options.map((id) => {
          const t = TECHNIQUE_BY_ID[id as TechniqueId];
          const state = !answered
            ? "none"
            : id === ex.answer
              ? "right"
              : id === choice
                ? "wrong"
                : "none";
          return (
            <OptionButton
              key={id}
              selected={choice === id}
              locked={answered}
              state={state}
              onClick={() => setChoice(id)}
            >
              <span className="font-medium">{t?.name ?? id}</span>
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

function ValueBody({
  ex,
  choice,
  setChoice,
  answered,
}: {
  ex: Extract<Exercise, { kind: "value" }>;
  choice: string | null;
  setChoice: (v: string) => void;
  answered: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="micro-label">What is it worth?</p>
        <div className="mt-4 overflow-x-auto py-3 text-center">
          <Tex block>{ex.front}</Tex>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ex.options.map((opt) => {
          const state = !answered
            ? "none"
            : opt === ex.answer
              ? "right"
              : opt === choice
                ? "wrong"
                : "none";
          return (
            <OptionButton
              key={opt}
              selected={choice === opt}
              locked={answered}
              state={state}
              onClick={() => setChoice(opt)}
            >
              <span className="overflow-x-auto">
                <Tex>{opt}</Tex>
              </span>
            </OptionButton>
          );
        })}
      </div>
    </div>
  );
}

function OrderBody({
  ex,
  ordering,
  setOrdering,
  answered,
}: {
  ex: Extract<Exercise, { kind: "order" }>;
  ordering: string[];
  setOrdering: (v: string[]) => void;
  answered: boolean;
}) {
  const remaining = ex.shuffled.filter((s) => !ordering.includes(s));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="micro-label">Put the method in order</p>
        <h2 className="font-display mt-1.5 text-[19px] font-semibold text-foreground">
          {TECHNIQUE_BY_ID[ex.technique]?.name ?? ex.technique}
        </h2>
      </div>

      <ol className="flex min-h-[132px] flex-col gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-3">
        {ordering.length === 0 && (
          <li className="grid h-[108px] place-items-center text-[13.5px] text-muted-foreground">
            Tap the steps below in the right order.
          </li>
        )}
        {ordering.map((step, i) => {
          const right = answered && ex.correct[i] === step;
          const wrong = answered && ex.correct[i] !== step;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={answered}
                onClick={() => setOrdering(ordering.filter((s) => s !== step))}
                className={`glass-card flex w-full gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed transition-colors ${
                  right
                    ? "border-[var(--success)]"
                    : wrong
                      ? "border-[var(--status-red)]"
                      : "border-border hover:border-primary/40"
                }`}
              >
                <span className="readout shrink-0 text-primary">{i + 1}</span>
                <span className="min-w-0">
                  <Tex>{step}</Tex>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2">
        {remaining.map((step) => (
          <button
            key={step}
            type="button"
            disabled={answered}
            onClick={() => setOrdering([...ordering, step])}
            className="glass-card glass-card-hover rounded-xl border border-border px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed text-foreground transition-colors"
          >
            <Tex>{step}</Tex>
          </button>
        ))}
      </div>
    </div>
  );
}

function CompleteBody({
  ex,
  input,
  setInput,
  onSubmit,
  answered,
  verdict,
}: {
  ex: Extract<Exercise, { kind: "complete" }>;
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  answered: boolean;
  verdict: React.ComponentProps<typeof AnswerInput>["verdict"];
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="micro-label">Finish it off</p>
      <ol className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4 sm:p-5">
        {ex.setup.map((line, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted-foreground">
            <span className="readout shrink-0 text-primary">{i + 1}</span>
            <span className="min-w-0 overflow-x-auto">
              <Tex>{line}</Tex>
            </span>
          </li>
        ))}
        <li className="mt-1 rounded-xl border border-dashed border-primary/40 bg-primary/[0.06] px-3.5 py-3 text-[14px] leading-relaxed text-foreground">
          <Tex>{ex.blank}</Tex>
        </li>
      </ol>
      <AnswerInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        verdict={verdict}
        disabled={answered}
        placeholder="The closed form"
      />
      {answered && (
        <p className="text-[13.5px] text-muted-foreground">
          Reference: <Tex>{ex.answerLatex}</Tex>
        </p>
      )}
    </div>
  );
}

function SolveBody({
  ex,
  input,
  setInput,
  onSubmit,
  answered,
  verdict,
  hintsOpen,
  openHint,
}: {
  ex: Extract<Exercise, { kind: "solve" }>;
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  answered: boolean;
  verdict: React.ComponentProps<typeof AnswerInput>["verdict"];
  hintsOpen: number;
  openHint: () => void;
}) {
  const problem = PROBLEM_BY_ID[ex.problemId];
  if (!problem) return null;
  return (
    <div className="flex flex-col gap-5">
      <IntegralPrompt problem={problem} />
      <AnswerInput
        value={input}
        onChange={setInput}
        onSubmit={onSubmit}
        verdict={verdict}
        disabled={answered}
        problem={problem}
      />
      {ex.hintsAllowed && hintsOpen < problem.hints.length && !answered && (
        <button
          type="button"
          onClick={openHint}
          className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Lightbulb className="h-3.5 w-3.5" /> Hint
        </button>
      )}
      {hintsOpen > 0 && (
        <ol className="flex flex-col gap-2">
          {problem.hints.slice(0, hintsOpen).map((h, i) => (
            <li
              key={i}
              className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted-foreground"
            >
              <Tex>{h}</Tex>
            </li>
          ))}
        </ol>
      )}
      {answered && (
        <p className="text-[13.5px] text-muted-foreground">
          Answer: <Tex>{problem.answerLatex}</Tex>
        </p>
      )}
    </div>
  );
}

// ── the page ───────────────────────────────────────────────────────────────────────────────────

export default function UkuibLesson() {
  const { skillId = "" } = useParams();
  const navigate = useNavigate();
  const run = useUkuibLesson(skillId);
  const skill = SKILL_BY_ID[skillId];

  const [input, setInput] = useState("");
  const [ordering, setOrdering] = useState<string[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const [hintsOpen, setHintsOpen] = useState(0);

  // A fresh exercise is a fresh set of local answer state.
  useEffect(() => {
    setInput("");
    setOrdering([]);
    setChoice(null);
    setHintsOpen(0);
  }, [run.index, run.plan]);

  const ex = run.current;

  const canSubmit = useMemo(() => {
    if (!ex || run.answered) return false;
    switch (ex.kind) {
      case "teach":
        return true;
      case "recognise":
      case "value":
        return choice !== null;
      case "order":
        return ordering.length === ex.correct.length;
      case "complete":
      case "solve":
        return input.trim().length > 0;
    }
  }, [ex, run.answered, choice, ordering, input]);

  const submit = useCallback(() => {
    if (!ex || run.answered) return;
    let response: ExerciseResponse;
    switch (ex.kind) {
      case "teach":
        response = { kind: "teach" };
        break;
      case "recognise":
        if (choice === null) return;
        response = { kind: "recognise", choice: choice as TechniqueId };
        break;
      case "value":
        if (choice === null) return;
        response = { kind: "value", choice };
        break;
      case "order":
        response = { kind: "order", ordering };
        break;
      case "complete":
        response = { kind: "complete", input };
        break;
      case "solve":
        response = { kind: "solve", input };
        break;
    }
    run.submit(response);
  }, [ex, run, choice, ordering, input]);

  const primaryAction = run.answered ? run.next : submit;

  // Enter drives the whole lesson: check, then continue. A player you can run one-handed is a
  // player people actually finish.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || run.phase !== "running") return;
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement) return;
      if (!run.answered && !canSubmit) return;
      e.preventDefault();
      primaryAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primaryAction, canSubmit, run.answered, run.phase]);

  const exitTo = `/ukuib/skill/${skillId}`;

  if (!skill) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <p className="text-[15px] text-muted-foreground">That skill doesn't exist.</p>
          <Link to="/ukuib" className="mt-3 inline-block text-[14px] text-primary">
            Back to the path
          </Link>
        </div>
      </main>
    );
  }

  if (run.plan.exercises.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div className="max-w-sm">
          <p className="text-[15px] text-foreground">This skill has no material yet.</p>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Its lesson and problem bank are still being written.
          </p>
          <Link to="/ukuib" className="mt-4 inline-block text-[14px] text-primary">
            Back to the path
          </Link>
        </div>
      </main>
    );
  }

  // ── end screens ──────────────────────────────────────────────────────────────────────────────

  if (run.phase !== "running") {
    const won = run.phase === "done";
    const accuracy = run.scored > 0 ? Math.round((run.correct / run.scored) * 100) : 100;
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6 py-16">
        <div
          aria-hidden
          className="ambient-drift pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background: won
              ? "radial-gradient(circle, color-mix(in oklab, var(--xp-gold) 34%, transparent), transparent 65%)"
              : "radial-gradient(circle, color-mix(in oklab, var(--status-red) 22%, transparent), transparent 65%)",
          }}
        />
        <div className="reveal relative w-full max-w-md text-center">
          <span
            className={`mx-auto grid h-20 w-20 place-items-center rounded-full border ${
              won
                ? "border-[var(--xp-gold)]/50 bg-[var(--xp-gold)]/10 text-[var(--xp-gold)]"
                : "border-[var(--status-red)]/40 bg-[var(--status-red)]/10 text-[var(--status-red)]"
            }`}
            style={
              won
                ? { boxShadow: "0 0 44px -8px color-mix(in oklab, var(--xp-gold) 60%, transparent)" }
                : undefined
            }
          >
            {won ? <Crown className="h-9 w-9" /> : <Heart className="h-9 w-9" />}
          </span>
          <h1 className="font-display mt-6 text-[27px] font-semibold tracking-[-0.02em] text-foreground">
            {won ? "Lesson complete" : "Out of hearts"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {won
              ? `${skill.name} — ${accuracy}% accuracy.`
              : "The lesson is unchanged when you come back. Take it again."}
          </p>

          <div className="mt-7 grid grid-cols-3 gap-3">
            <div className="glass-card rounded-2xl px-3 py-4">
              <div className="readout text-[20px] font-semibold text-foreground">+{run.xp}</div>
              <div className="text-[11.5px] text-muted-foreground">XP</div>
            </div>
            <div className="glass-card rounded-2xl px-3 py-4">
              <div className="readout text-[20px] font-semibold text-foreground">
                {run.correct}/{run.scored}
              </div>
              <div className="text-[11.5px] text-muted-foreground">correct</div>
            </div>
            <div className="glass-card rounded-2xl px-3 py-4">
              <div className="readout text-[20px] font-semibold text-foreground">{run.hearts}</div>
              <div className="text-[11.5px] text-muted-foreground">hearts left</div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={run.retry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_10px_30px_-10px_hsl(var(--primary)/0.7)] transition-opacity hover:opacity-90"
            >
              <RotateCcw className="h-4 w-4" />
              {won ? "Another lesson" : "Try again"}
            </button>
            <button
              type="button"
              onClick={() => navigate(exitTo)}
              className="rounded-xl border border-border px-5 py-3 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to {skill.name}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── running ──────────────────────────────────────────────────────────────────────────────────

  const correctNow = run.result?.correct === true;
  const wrongNow = run.answered && !correctNow;

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-5 py-3.5 sm:px-6">
          <Link
            to={exitTo}
            aria-label="Leave the lesson"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Link>
          <ProgressBar value={run.index} total={run.plan.exercises.length} />
          <Hearts left={run.hearts} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6 sm:py-10">
        {ex?.kind === "teach" && <TeachCard ex={ex} />}
        {ex?.kind === "recognise" && (
          <RecogniseBody ex={ex} choice={choice} setChoice={setChoice} answered={run.answered} />
        )}
        {ex?.kind === "value" && (
          <ValueBody ex={ex} choice={choice} setChoice={setChoice} answered={run.answered} />
        )}
        {ex?.kind === "order" && (
          <OrderBody
            ex={ex}
            ordering={ordering}
            setOrdering={setOrdering}
            answered={run.answered}
          />
        )}
        {ex?.kind === "complete" && (
          <CompleteBody
            ex={ex}
            input={input}
            setInput={(v) => {
              run.noteKeystroke();
              setInput(v);
            }}
            onSubmit={submit}
            answered={run.answered}
            verdict={run.result?.verdict ?? null}
          />
        )}
        {ex?.kind === "solve" && (
          <SolveBody
            ex={ex}
            input={input}
            setInput={(v) => {
              run.noteKeystroke();
              setInput(v);
            }}
            onSubmit={submit}
            answered={run.answered}
            verdict={run.result?.verdict ?? null}
            hintsOpen={hintsOpen}
            openHint={() => setHintsOpen((n) => n + 1)}
          />
        )}
      </div>

      <footer
        className={`sticky bottom-0 border-t backdrop-blur-xl transition-colors duration-300 ${
          correctNow
            ? "border-[var(--success)]/40 bg-[color-mix(in_oklab,var(--success)_10%,var(--background))]"
            : wrongNow
              ? "border-[var(--status-red)]/40 bg-[color-mix(in_oklab,var(--status-red)_9%,var(--background))]"
              : "border-border bg-background/85"
        }`}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <p
            className={`text-[14px] font-medium ${
              correctNow
                ? "text-[var(--success)]"
                : wrongNow
                  ? "text-[var(--status-red)]"
                  : "text-muted-foreground"
            }`}
          >
            {correctNow && (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Correct
              </span>
            )}
            {wrongNow &&
              (run.result?.verdict?.status === "off-by-constant-factor"
                ? "Right shape, wrong constant."
                : "Not quite.")}
            {!run.answered && ex?.kind === "teach" && "Read it, then carry on."}
          </p>
          <button
            type="button"
            onClick={primaryAction}
            disabled={!run.answered && !canSubmit}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              correctNow
                ? "bg-[var(--success)] text-background"
                : wrongNow
                  ? "bg-[var(--status-red)] text-background"
                  : "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_8px_26px_-10px_hsl(var(--primary)/0.7)]"
            }`}
          >
            {run.answered
              ? run.index === run.plan.exercises.length - 1
                ? "Finish"
                : "Continue"
              : ex?.kind === "teach"
                ? "Got it"
                : "Check"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </main>
  );
}
