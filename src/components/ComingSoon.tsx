import { Link } from "react-router-dom";
import { Clock3, Sigma, Zap, ArrowRight } from "lucide-react";
import AppShell from "@/components/AppShell";

interface ComingSoonProps {
  /** What the visitor was trying to reach, e.g. "Learning tracks", "Resources". */
  feature: string;
}

/**
 * Stands in for every feature that isn't live yet in the beta. Cortexed's real surface right now
 * is Drills and Integral Arena — everything else on the sidebar still routes here rather than
 * disappearing, so a signup never hits a dead link or an unexplained 404. Every signup is
 * effectively already "on the list" for full access (no separate opt-in), so the copy says that
 * plainly instead of asking them to do anything.
 */
export default function ComingSoon({ feature }: ComingSoonProps) {
  return (
    <AppShell>
      <main className="mx-auto flex max-w-2xl flex-col items-center px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="reveal flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-accent/40 text-muted-foreground">
          <Clock3 className="h-6 w-6" />
        </div>
        <h1 className="reveal mt-6 font-display text-[26px] font-semibold tracking-[-0.02em] text-foreground sm:text-[30px]">
          {feature} is coming soon
        </h1>
        <p className="reveal mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Cortexed is in beta — we're rolling features out one at a time. You're already on the
          list for {feature.toLowerCase()}, no action needed. We'll email you the moment it opens up.
        </p>

        <div className="reveal mt-9 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/drills"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:flex-none"
          >
            <Zap className="h-4 w-4" />
            Play Drills <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/integrals"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-accent/30 px-6 text-[14px] font-semibold text-foreground transition-colors hover:bg-accent/50 sm:flex-none"
          >
            <Sigma className="h-4 w-4" />
            Play Integral Arena <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
