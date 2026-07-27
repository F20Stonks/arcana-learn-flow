/**
 * OBSIDIAN INSTRUMENT — top command bar.
 * Hairline-bottom glass bar; wordmark left; streak/points as quiet mono
 * "instrument readouts"; icon cluster with tooltips on the right.
 *
 * Ported from the Manus mockup (client/src/components/CommandBar.tsx). Differences from
 * that file, and why:
 *  - user.streak / user.points (fake) -> profile?.weekly_streak / profile?.total_xp (real).
 *  - The referenced /manus-storage/jarvis-logo_*.png isn't in the delivered assets at all
 *    (the zip ships no images), so the wordmark mark is an inline SVG on the same
 *    point-mass/orbit motif described in the mockup's own design notes. Same slot, same size.
 *  - Palette and "Apps" were toast() stubs for two already-real features. Rather than fake
 *    the buttons, CustomizeMenu and HubSidebar are mounted directly — each owns its own
 *    trigger, so their trigger buttons were restyled (see those files) to match this bar's
 *    IconButton chrome instead of duplicating that chrome here. They're the only two icons
 *    without a Tooltip wrapper as a result; every other icon keeps Manus's exact pattern.
 *  - Settings navigates to /settings; Sign out calls the real signOut().
 */
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, Trophy, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import CustomizeMenu from "@/components/CustomizeMenu";
import HubSidebar from "@/components/HubSidebar";
import SafeBoundary from "@/components/SafeBoundary";

function BrandMark() {
  return (
    <svg
      className="h-8 w-8 transition-transform duration-500 group-hover:rotate-[24deg]"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="16" rx="14" ry="6.4" stroke="#38BDF8" strokeOpacity="0.45" strokeWidth="1" transform="rotate(-28 16 16)" />
      <ellipse cx="16" cy="16" rx="14" ry="6.4" stroke="#38BDF8" strokeOpacity="0.18" strokeWidth="1" transform="rotate(38 16 16)" />
      <circle cx="16" cy="16" r="3.1" fill="#38BDF8" />
      <circle cx="16" cy="16" r="6" fill="#38BDF8" fillOpacity="0.18" />
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function Readout({
  icon,
  value,
  label,
  active,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex h-9 cursor-default items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 ${
            active ? "text-amber-300/90" : "text-zinc-500"
          }`}>
          {icon}
          <span className="readout text-[13px] text-zinc-300">{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function CommandBar() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const streak = profile?.weekly_streak ?? 0;
  const points = profile?.total_xp ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0C]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="/dashboard" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center">
            <BrandMark />
          </span>
          <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-zinc-50">
            Cortexed<span className="text-sky-400">.</span>
          </span>
        </a>

        <div className="flex items-center gap-2">
          <Readout icon={<Flame className="h-3.5 w-3.5" />} value={streak} label="Day streak" active={streak > 0} />
          <Readout icon={<Trophy className="h-3.5 w-3.5" />} value={points} label="Mastery points" />
          <div className="mx-1.5 hidden h-5 w-px bg-white/[0.08] sm:block" />
          <div className="hidden items-center sm:flex">
            <SafeBoundary label="Appearance" compact>
              <CustomizeMenu />
            </SafeBoundary>
            <SafeBoundary label="Hub" compact>
              <HubSidebar />
            </SafeBoundary>
            <IconButton label="Settings" onClick={() => navigate("/settings")}>
              <Settings className="h-[17px] w-[17px]" />
            </IconButton>
            <IconButton label="Sign out" onClick={signOut}>
              <LogOut className="h-[17px] w-[17px]" />
            </IconButton>
          </div>
        </div>
      </div>
    </header>
  );
}
