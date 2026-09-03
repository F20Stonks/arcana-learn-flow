/**
 * A unit checkpoint: ten problems, no hints, no teaching, pass at seven.
 *
 * Available before the unit as well as after it — that is the "jump here" affordance. Someone who
 * already integrates by parts in their sleep should be able to prove it in ten minutes rather than
 * grind five crowns of Foundations to reach Gamma, and making them grind teaches nothing except
 * that this app wastes their time.
 *
 * One pass through, forwards only. A checkpoint you can revisit and edit is a worksheet; this is
 * meant to measure what you can do on sight.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import Tex from "@/features/integrals/components/Tex";
import AnswerInput from "@/features/integrals/components/AnswerInput";
import IntegralPrompt from "@/features/integrals/components/IntegralPrompt";
import { gradeAnswer } from "@/features/integrals/answer";
import { recordAttempt } from "@/features/integrals/attempts";
import { UNIT_BY_ID, type UnitId } from "@/features/integrals/ukuib/curriculum";
import { CHECKPOINT_LENGTH, planCheckpoint } from "@/features/integrals/ukuib/checkpoint";
import {
  CHECKPOINT_PASS_RATIO,
  recordCheckpoint,
} from "@/features/integrals/ukuib/ukuibProgress";
import type { Verdict } from "@/features/integrals/types";

export default function UkuibCheckpoint() {
  const { unitId = "" } = useParams();
  const navigate = useNavigate();
  const unit = UNIT_BY_ID[unitId];

  const [seed] = useState(() => Math.floor(Math.random() * 1e6));
  const plan = useMemo(() => planCheckpoint(unitId as UnitId, seed), [unitId, seed]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setInput("");
    setVerdict(null);
  }, [index]);

  const problem = plan.problems[index];

  const check = useCallback(() => {
    if (!problem || verdict || !input.trim()) return;
    const v = gradeAnswer(problem, input);
    setVerdict(v);
    recordAttempt({
      problemId: problem.id,
      mode: "ukuib",
      verdictClass: v.status,
      submitted: input,
      hintsOpen: 0,
      wrongAttemptsSoFar: 0,
      msToFirstKeystroke: null,
      msFirstKeystrokeToSubmit: null,
    });
    if (v.status === "correct") setScore((s) => s + 1);
  }, [problem, verdict, input]);

  const advance = useCallback(() => {
    if (index >= plan.problems.length - 1) {
      recordCheckpoint({ unitId: unitId as UnitId, score, total: plan.problems.length });
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, plan.problems.length, score, unitId]);

  // `skip` is deliberately a real, visible control rather than something hidden: a checkpoint you
  // cannot move past when you are stuck is a checkpoint people abandon halfway.
  const skip = useCallback(() => {
    setVerdict({ status: "incorrect" });
  }, []);

  if (!unit || plan.problems.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <p className="text-[15px] text-muted-foreground">
            {unit ? "This unit has no checkpoint yet." : "That unit doesn't exist."}
          </p>
          <Link to="/ukuib" className="mt-3 inline-block text-[14px] text-primary">
            Back to the path
          </Link>
        </div>
      </main>
    );
  }

  if (finished) {
    const passed = score / plan.problems.length >= CHECKPOINT_PASS_RATIO;
    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-6 py-16">
        <div
          aria-hidden
          className="ambient-drift pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background: passed
              ? "radial-gradient(circle, color-mix(in oklab, var(--success) 30%, transparent), transparent 65%)"
              : "radial-gradient(circle, color-mix(in oklab, var(--primary) 18%, transparent), transparent 65%)",
          }}
        />
        <div className="reveal relative w-full max-w-md text-center">
          <span
            className={`mx-auto grid h-20 w-20 place-items-center rounded-full border ${
              passed
                ? "border-[var(--success)]/50 bg-[var(--success)]/10 text-[var(--success)]"
                : "border-border bg-card text-muted-foreground"
            }`}
            style={
              passed
                ? { boxShadow: "0 0 44px -8px color-mix(in oklab, var(--success) 55%, transparent)" }
                : undefined
            }
          >
            <ShieldCheck className="h-9 w-9" />
          </span>
          <h1 className="font-display mt-6 text-[27px] font-semibold tracking-[-0.02em] text-foreground">
            {passed ? "Checkpoint passed" : "Not this time"}
          </h1>
          <p className="readout mt-3 text-[30px] font-semibold text-foreground">
            {score}
            <span className="text-muted-foreground">/{plan.problems.length}</span>
          </p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
            {passed
              ? `${unit.name} is proved — the next unit is open.`
              : `You need ${Math.ceil(plan.problems.length * CHECKPOINT_PASS_RATIO)} to pass. Work the unit's skills and come back.`}
          </p>
          <button
            type="button"
            onClick={() => navigate("/ukuib")}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_10px_30px_-10px_hsl(var(--primary)/0.7)] transition-opacity hover:opacity-90"
          >
            Back to the path
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  const correct = verdict?.status === "correct";

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-5 py-3.5 sm:px-6">
          <Link
            to="/ukuib"
            aria-label="Leave the checkpoint"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Link>
          <div className="flex flex-1 items-center gap-1">
            {plan.problems.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < index ? "bg-primary" : i === index ? "bg-primary/45" : "bg-accent"
                }`}
              />
            ))}
          </div>
          <span className="readout text-[13px] text-muted-foreground">
            {index + 1}/{CHECKPOINT_LENGTH}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6 sm:py-10">
        <p className="micro-label mb-5">{unit.name} · checkpoint</p>
        <div className="flex flex-col gap-5">
          <IntegralPrompt problem={problem} />
          <AnswerInput
            value={input}
            onChange={setInput}
            onSubmit={check}
            verdict={verdict}
            disabled={verdict !== null}
            problem={problem}
            hideSubmit
          />
          {verdict && (
            <p className="text-[13.5px] text-muted-foreground">
              Answer: <Tex>{problem.answerLatex}</Tex>
            </p>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          {verdict ? (
            <p
              className={`inline-flex items-center gap-1.5 text-[14px] font-medium ${
                correct ? "text-[var(--success)]" : "text-muted-foreground"
              }`}
            >
              {correct ? (
                <>
                  <Check className="h-4 w-4" /> Correct
                </>
              ) : (
                "Moving on."
              )}
            </p>
          ) : (
            <button
              type="button"
              onClick={skip}
              className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip this one
            </button>
          )}
          <button
            type="button"
            onClick={verdict ? advance : check}
            disabled={!verdict && !input.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_8px_26px_-10px_hsl(var(--primary)/0.7)] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {verdict
              ? index === plan.problems.length - 1
                ? "See result"
                : "Next"
              : "Check"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </main>
  );
}
