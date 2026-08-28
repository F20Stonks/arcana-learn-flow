import { BookOpen, ChevronDown } from "lucide-react";
import Tex from "./Tex";
import type { Technique } from "../types";

interface Props {
  technique: Technique;
  open: boolean;
  onToggle: () => void;
  /** "The lesson" when it's embedded under a page that already names the technique; the technique's
   *  own name when it's standing alone in a list of many, as on the lessons page. */
  title?: string;
  /** Hides the collapsed-state tagline preview — the training page already shows it in its header. */
  showTaglineWhenCollapsed?: boolean;
}

/**
 * One technique's full lesson — when to reach for it, the recipe, a worked example, the pitfalls —
 * as a collapsible disclosure. Shared between the training page (where it sits above a live
 * practice queue) and the standalone lessons page (where it's the whole point), so the two never
 * drift apart.
 */
export default function TechniqueLesson({
  technique,
  open,
  onToggle,
  title = "The lesson",
  showTaglineWhenCollapsed = false,
}: Props) {
  return (
    <section className="reveal overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${technique.id}-lesson`}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-display text-[16px] font-semibold text-foreground">{title}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {!open && showTaglineWhenCollapsed && (
        <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-muted-foreground">
          <Tex>{technique.tagline}</Tex>
        </p>
      )}

      {open && (
        <div id={`${technique.id}-lesson`} className="border-t border-border px-5 pb-5 pt-4">
          <h3 className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">When to reach for it</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            <Tex>{technique.whenToUse}</Tex>
          </p>

          <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">The recipe</h3>
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

          <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Worked example</h3>
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

          <h3 className="mt-5 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Where it goes wrong</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {technique.pitfalls.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <Tex>{p}</Tex>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
