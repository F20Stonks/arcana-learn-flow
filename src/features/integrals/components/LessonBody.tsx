/**
 * The body of a technique lesson — when to reach for it, the recipe, a worked example, the traps.
 *
 * Lives on its own so the same lesson renders in two places: collapsed inside the practice screen,
 * and in the standalone Lessons library where you can read without drilling.
 */
import Tex from "@/features/integrals/components/Tex";
import type { Technique } from "@/features/integrals/types";

export default function LessonBody({ technique }: { technique: Technique }) {
  return (
    <>
      <h3 className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
        When to reach for it
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground">
        <Tex>{technique.whenToUse}</Tex>
      </p>

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
        Worked example
      </h3>
      <div className="mt-2 rounded-xl bg-accent/50 px-4 py-4">
        <div className="overflow-x-auto text-center">
          <Tex block className="text-foreground">{`\\int ${technique.example.integrand}\\,dx`}</Tex>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {technique.example.work.map((w, i) => (
            <li key={i} className="text-[14px] leading-relaxed text-foreground">
              <Tex>{w}</Tex>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border/60 pt-3 text-center">
          <Tex className="text-foreground">{technique.example.result}</Tex>
        </div>
      </div>

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
    </>
  );
}
