/**
 * The body of a technique lesson — prerequisites, when to reach for it, why it works, the recipe,
 * worked example(s), the traps, and a self-check. Lives on its own so the same lesson renders in
 * two places: collapsed inside the practice screen, and in the standalone Lessons library where you
 * can read without drilling.
 *
 * Graduated examples (`technique.examples`) are the A-level-bridge rebuild's answer to the old
 * single-`example` schema being a reference card for someone who already knows the method: the
 * first spells out every algebraic step, later ones compress as the reader gains footing. A lesson
 * not yet rebuilt has no `examples` array — this falls back to the legacy singular `example`, which
 * every technique still carries (see types.ts's Technique.example doc comment for why).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, HelpCircle, Lightbulb, PenLine } from "lucide-react";
import Tex from "@/features/integrals/components/Tex";
import { TECHNIQUES } from "@/features/integrals/techniques";
import type { Completion, Technique, WorkedExample } from "@/features/integrals/types";

function ExampleCard({ example, label }: { example: WorkedExample; label?: string }) {
  return (
    <div className="mt-2 rounded-xl bg-accent/50 px-4 py-4">
      {label && (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
      )}
      <div className="overflow-x-auto text-center">
        <Tex block className="text-foreground">{`\\int ${example.integrand}\\,dx`}</Tex>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {example.work.map((w, i) => (
          <li key={i} className="text-[14px] leading-relaxed text-foreground">
            <Tex>{w}</Tex>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-border/60 pt-3 text-center">
        <Tex className="text-foreground">{example.result}</Tex>
      </div>
    </div>
  );
}

/** Links a prerequisite to its own lesson when the text names an existing technique; plain text
 *  otherwise (a prerequisite can also be a bare skill — "the double-angle identities" — with no
 *  lesson of its own to link to). */
function PrerequisiteChip({ text }: { text: string }) {
  const match = TECHNIQUES.find((t) => t.name.toLowerCase() === text.toLowerCase());
  const inner = <Tex>{text}</Tex>;
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-[13px] text-foreground">
      {match ? (
        <Link
          to={`/integrals/train/${match.id}`}
          className="underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary hover:decoration-primary"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </span>
  );
}

/**
 * A completion problem: the setup steps render exactly like an ExampleCard's `work` list, then a
 * dashed "gap" box describes what's missing and reveals `answer` on demand — same reveal mechanic as
 * CheckYourself, but the reader has already been walked most of the way there, which is the whole
 * point (see Completion's doc comment in types.ts for why this sits between a full worked example
 * and an unaided problem rather than duplicating either).
 */
function CompletionCard({ item, label }: { item: Completion; label?: string }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="mt-2 rounded-xl bg-accent/50 px-4 py-4">
      {label && (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {item.setup.map((s, i) => (
          <li key={i} className="text-[14px] leading-relaxed text-foreground">
            <Tex>{s}</Tex>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg border border-dashed border-primary/30 bg-primary/[0.04] px-3 py-3 text-center">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <Tex>{item.blank}</Tex>
        </p>
        <button
          type="button"
          onClick={() => setShowAnswer((v) => !v)}
          aria-expanded={showAnswer}
          className="mt-2.5 text-[13px] text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:opacity-80"
        >
          {showAnswer ? "Hide completion" : "Show completion"}
        </button>
        {showAnswer && (
          <p className="mt-3 border-t border-border/60 pt-3 text-[14px] leading-relaxed text-foreground">
            <Tex>{item.answer}</Tex>
          </p>
        )}
      </div>
    </div>
  );
}

/** A single reflection question — reveal-only, the same mechanic as CheckYourself but with no hint
 *  stage: there's nothing to nudge towards, only reasoning to reveal. */
function SelfExplain({ item }: { item: NonNullable<Technique["selfExplain"]> }) {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <div className="mt-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-4 py-4">
      <p className="text-center text-[14px] leading-relaxed text-foreground">
        <Tex>{item.prompt}</Tex>
      </p>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => setShowAnswer((v) => !v)}
          aria-expanded={showAnswer}
          className="text-[13px] text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:opacity-80"
        >
          {showAnswer ? "Hide answer" : "Show answer"}
        </button>
      </div>
      {showAnswer && (
        <p className="mt-3 border-t border-border/60 pt-3 text-center text-[14px] leading-relaxed text-foreground">
          <Tex>{item.answer}</Tex>
        </p>
      )}
    </div>
  );
}

function CheckYourself({ item }: { item: NonNullable<Technique["checkYourself"]> }) {
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div className="mt-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-4 py-4">
      <div className="overflow-x-auto text-center">
        <Tex block className="text-foreground">{`\\int ${item.prompt}\\,dx`}</Tex>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[13px]">
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          aria-expanded={showHint}
          className="text-muted-foreground underline decoration-muted-foreground/40 underline-offset-2 transition-colors hover:text-foreground"
        >
          {showHint ? "Hide hint" : "Need a hint?"}
        </button>
        <button
          type="button"
          onClick={() => setShowAnswer((v) => !v)}
          aria-expanded={showAnswer}
          className="text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:opacity-80"
        >
          {showAnswer ? "Hide answer" : "Show answer"}
        </button>
      </div>
      {showHint && (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-muted-foreground">
          <Tex>{item.hint}</Tex>
        </p>
      )}
      {showAnswer && (
        <p className="mt-3 border-t border-border/60 pt-3 text-center text-[14px] text-foreground">
          <Tex>{item.answer}</Tex>
        </p>
      )}
    </div>
  );
}

export default function LessonBody({ technique }: { technique: Technique }) {
  const examples = technique.examples ?? [technique.example];

  return (
    <>
      {technique.prerequisites && technique.prerequisites.length > 0 && (
        <>
          <h3 className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
            Be solid on first
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {technique.prerequisites.map((p, i) => (
              <PrerequisiteChip key={i} text={p} />
            ))}
          </div>
        </>
      )}

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground first:mt-0">
        When to reach for it
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground">
        <Tex>{technique.whenToUse}</Tex>
      </p>

      {technique.intuition && (
        <>
          <h3 className="mt-5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" /> Why it works
          </h3>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            <Tex>{technique.intuition}</Tex>
          </p>
        </>
      )}

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        The recipe
      </h3>
      <ol className="mt-2 flex flex-col gap-2">
        {technique.recipe.map((r, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-foreground">
            <span className="readout mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <Tex>{r}</Tex>
          </li>
        ))}
      </ol>

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        {examples.length > 1 ? "Worked examples" : "Worked example"}
      </h3>
      {examples.map((ex, i) => (
        <ExampleCard
          key={i}
          example={ex}
          label={examples.length > 1 ? `Example ${i + 1} of ${examples.length}` : undefined}
        />
      ))}

      {technique.completions && technique.completions.length > 0 && (
        <>
          <h3 className="mt-5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" /> Complete it
          </h3>
          {technique.completions.map((c, i) => (
            <CompletionCard
              key={i}
              item={c}
              label={
                technique.completions!.length > 1
                  ? `Completion ${i + 1} of ${technique.completions!.length}`
                  : undefined
              }
            />
          ))}
        </>
      )}

      {technique.selfExplain && (
        <>
          <h3 className="mt-5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" /> Think about it
          </h3>
          <SelfExplain item={technique.selfExplain} />
        </>
      )}

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        Where it goes wrong
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {technique.pitfalls.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
            <Tex>{p}</Tex>
          </li>
        ))}
      </ul>

      {technique.checkYourself && (
        <>
          <h3 className="mt-5 flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
            <ChevronRight className="h-3.5 w-3.5" /> Check yourself
          </h3>
          <CheckYourself item={technique.checkYourself} />
        </>
      )}
    </>
  );
}
