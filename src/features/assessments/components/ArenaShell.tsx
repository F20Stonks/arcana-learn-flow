import { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * The Arena's own frame.
 *
 * Deliberately NOT src/components/AppShell.tsx. The project owner's call: this section lives in
 * Cortexed but is built without regard to or integration with the rest of it. AppShell is the
 * opposite of that — it carries the sidebar of study destinations, the XP and streak readouts, the
 * due-review count and the assistant palette, and adopting it would wire this feature into all of
 * them by default.
 *
 * What that isolation buys, concretely: nothing in the main app's progression can change what a
 * candidate sees here, a change to AppShell's nav cannot break an assessment mid-run, and this
 * section can be lifted out of the repo whole if it ever becomes its own product.
 *
 * The one concession is a way back. A section with no exit is a trap, not an independent surface.
 */
export default function ArenaShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-foreground">
              OA Arena
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Quant assessments
            </span>
          </div>
          <Link
            to="/dashboard"
            className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Leave the Arena
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
