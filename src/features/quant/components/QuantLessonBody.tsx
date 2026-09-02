/**
 * The body of a topic lesson — when to reach for it, the recipe, a worked example, the traps.
 * Mirrors Integral Arena's LessonBody shape (whenToUse/recipe/example/pitfalls) since that
 * lesson-before-practice pattern is already proven, but renders independently via the shared
 * MathRenderer rather than reaching into src/features/integrals, which stays untouched.
 */
import { MathRenderer } from "@/components/MathRenderer";
import type { QuantTopic } from "../types";

export default function QuantLessonBody({ topic }: { topic: QuantTopic }) {
  return (
    <>
      <h3 className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">When to reach for it</h3>
      <div className="mt-2 text-[14px] leading-relaxed text-foreground">
        <MathRenderer content={topic.whenToUse} />
      </div>

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">The recipe</h3>
      <ol className="mt-2 flex flex-col gap-2">
        {topic.recipe.map((r, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-foreground">
            <span className="readout mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <MathRenderer content={r} />
            </div>
          </li>
        ))}
      </ol>

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Worked example</h3>
      <div className="mt-2 rounded-xl bg-accent/50 px-4 py-4">
        <div className="text-[14px] font-medium text-foreground">
          <MathRenderer content={topic.example.prompt} />
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {topic.example.work.map((w, i) => (
            <li key={i} className="text-[14px] leading-relaxed text-foreground">
              <MathRenderer content={w} />
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border/60 pt-3 text-[14px] font-semibold text-foreground">
          <MathRenderer content={topic.example.result} />
        </div>
      </div>

      <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Where it goes wrong</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {topic.pitfalls.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
            <div className="min-w-0 flex-1">
              <MathRenderer content={p} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
