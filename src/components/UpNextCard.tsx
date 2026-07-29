/**
 * OBSIDIAN INSTRUMENT — "Up next" hero card.
 * One idea per viewport: the single next session, presented like a boarding
 * pass. Mono countdown readout, display-type session title, cyan primary CTA.
 * Resume rows are quiet secondary items with hover reveal.
 *
 * Ported from the Manus mockup (client/src/components/UpNextCard.tsx). Differences from
 * that file, and why:
 *  - upNext/resumeItems/user (all fake, from dashboardData.ts) -> a real NextActionPlan
 *    (see useNextAction / lib/nextAction.ts), the same deterministic "what to do next"
 *    engine NextActionCard already used. This card is that engine's replacement rendering,
 *    not a second, independent one — Manus's own design note was "removing one whole card
 *    reduces cognitive load," and duplicating the recommendation logic would undercut that.
 *  - The CTA read a hardcoded "Continue session" in the mockup. The real recommendation's
 *    action isn't always "continue" — it can be "Start review", "Review early", or
 *    "Start a new track" depending on what's actually due. Hardcoding the old label would
 *    have made the button lie about what clicking it does, so this uses the plan's real
 *    `cta` text. Everything else — layout, type, colour — is unchanged.
 *  - The hero hero-orbital.png referenced by the mockup isn't in the delivered assets, so
 *    the ambient artwork is inline SVG on the same orbit motif, same position/mask/opacity.
 *  - "Ask Cortexed" was a toast() stub; it now toggles the real GeneralChat panel via a
 *    prop from Dashboard (GeneralChat itself isn't something Manus designed a home for,
 *    so Dashboard renders it below this card rather than this file inventing a slot for it).
 */
import { Play, ArrowUpRight, Clock, MessageCircle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NextActionPlan } from "@/lib/nextAction";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function OrbitalArt() {
  return (
    <svg
      className="ambient-drift pointer-events-none absolute -right-24 -top-24 h-[460px] w-[720px] opacity-70"
      viewBox="0 0 720 460"
      fill="none"
      aria-hidden
      style={{
        color: "var(--primary)",
        maskImage: "radial-gradient(ellipse 60% 60% at 70% 40%, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 70% 40%, black 30%, transparent 75%)",
      }}
    >
      <defs>
        <radialGradient id="upnext-core" cx="50%" cy="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g stroke="currentColor" strokeWidth="1" transform="translate(430 210)">
        <ellipse rx="230" ry="88" strokeOpacity="0.22" transform="rotate(-22)" />
        <ellipse rx="180" ry="66" strokeOpacity="0.16" transform="rotate(-22)" />
        <ellipse rx="128" ry="46" strokeOpacity="0.12" transform="rotate(-22)" />
        <ellipse rx="212" ry="80" strokeOpacity="0.08" transform="rotate(34)" />
      </g>
      <circle cx="430" cy="210" r="70" fill="url(#upnext-core)" opacity="0.5" />
      <circle cx="430" cy="210" r="4.5" fill="currentColor" />
      <circle cx="644" cy="124" r="3" fill="currentColor" opacity="0.75" />
      <circle cx="253" cy="286" r="2.2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export default function UpNextCard({
  plan,
  displayName,
  onToggleChat,
}: {
  plan: NextActionPlan;
  displayName: string;
  onToggleChat: () => void;
}) {
  const navigate = useNavigate();
  const { primary, secondary } = plan;
  const hasMinutes = primary.estimatedMinutes !== null;

  return (
    <section className="reveal" style={{ animationDelay: "60ms" }}>
      {/* Greeting line — replaces the old "Welcome back" card to reduce load */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground sm:text-[32px]">
            {greeting()}, <span className="font-serif-accent font-normal text-foreground/80">{displayName}</span>
          </h1>
        </div>
        <button
          onClick={onToggleChat}
          className="flex h-10 items-center gap-2 rounded-full border border-border bg-accent/40 px-4 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground">
          <MessageCircle className="h-4 w-4 text-primary" />
          Ask Cortexed
        </button>
      </div>

      {/* Up next card */}
      <div className="glass-card upnext-glow relative overflow-hidden rounded-3xl border-border">
        <OrbitalArt />
        <div className="relative p-7 sm:p-10">
          <div className="micro-label mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="dot-glow-primary inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Up next
          </div>

          <h2 className="font-display max-w-2xl text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[38px]">
            {primary.label}
          </h2>

          {(hasMinutes || primary.trackTitle) && (
            <div className="readout mt-4 flex items-center gap-3 text-[12.5px] text-muted-foreground">
              {hasMinutes && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />~{primary.estimatedMinutes} MIN
                </span>
              )}
              {hasMinutes && primary.trackTitle && <span className="text-muted-foreground/60">·</span>}
              {primary.trackTitle && <span className="truncate">{primary.trackTitle}</span>}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => navigate(primary.to)}
              className="glow-cyan glow-cyan-hover flex h-12 items-center gap-2.5 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-all hover:bg-primary/90">
              <Play className="h-4 w-4 fill-current" />
              {primary.cta}
              <ChevronRight className="h-4 w-4 opacity-60" />
            </button>
          </div>

          {/* Resume rows */}
          {secondary.length > 0 && (
            <div className="mt-9 border-t border-border pt-4">
              <p className="micro-label mb-2">Continue</p>
              <ul>
                {secondary.map((item) => (
                  <li key={item.to}>
                    <button
                      onClick={() => navigate(item.to)}
                      className="group flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent/50">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-foreground/80 transition-colors group-hover:text-foreground">
                          {item.label}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {item.trackTitle}
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
