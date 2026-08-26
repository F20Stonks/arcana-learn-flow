/**
 * The app shell — one persistent frame around every signed-in surface.
 *
 * Why this exists: the app previously grew page by page, and each page shipped its own top area
 * or none at all. The measured result was that the header rendered on 2 of 10 pages, Analytics and
 * Resource Bank were dead ends with no way back, Track Overview dropped all chrome, five features
 * sat behind one unlabelled icon, and on mobile the entire control cluster was `hidden sm:flex`
 * with no fallback — Settings and Sign out were literally unreachable on a phone.
 *
 * Division of labour (chosen with the user): the SIDEBAR owns destinations, the TOP BAR owns
 * identity, instrument readouts and the account. Destinations are always named in text, never
 * icon-only, because an unlabelled icon is how a feature becomes invisible.
 *
 * The Knowledge group (Concepts / Map / Review Calendar) used to be three tabs of a right-hand
 * slide-over addressed as sidebar destinations. They are their own routes now, so those entries
 * behave like every other one: a URL, a back button, something to refresh into.
 */
import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AssistantPalette from "@/components/AssistantPalette";
import {
  Home,
  Network,
  Brain,
  CalendarDays,
  Library,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Flame,
  Trophy,
  Zap,
  Sigma,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useDueReviewCount } from "@/hooks/useDueReviewCount";
import CustomizeMenu from "@/components/CustomizeMenu";
import SafeBoundary from "@/components/SafeBoundary";

const COLLAPSE_KEY = "cortexed.sidebarCollapsed";

function BrandMark() {
  return (
    <svg
      className="h-7 w-7 transition-transform duration-200 ease-out group-hover:rotate-[14deg]"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--primary)" }}
    >
      <ellipse cx="16" cy="16" rx="14" ry="6.4" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" transform="rotate(-28 16 16)" />
      <ellipse cx="16" cy="16" rx="14" ry="6.4" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" transform="rotate(38 16 16)" />
      <circle cx="16" cy="16" r="3.1" fill="currentColor" />
      <circle cx="16" cy="16" r="6" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

type NavItem = {
  label: string;
  icon: typeof Home;
  to: string;
  /** Extra routes that should also light this item up as current. */
  match?: (path: string) => boolean;
  badge?: number;
};

/** Grouped so the sidebar reads as three intentions — where I'm going, what I know, what I practise. */
function useNavGroups(dueReviews: number): { heading: string | null; items: NavItem[] }[] {
  return [
    {
      heading: null,
      items: [{ label: "Home", icon: Home, to: "/dashboard", match: (p) => p.startsWith("/dashboard") || p.startsWith("/track/") }],
    },
    {
      // These three were tabs in a right-hand slide-over. They're real routes now: a sheet has no
      // URL, no back button and nothing to refresh into, which is the wrong container for a
      // searchable list, a graph and a calendar.
      heading: "Knowledge",
      items: [
        { label: "Concepts", icon: Brain, to: "/concepts" },
        { label: "Map", icon: Network, to: "/map" },
        { label: "Review Calendar", icon: CalendarDays, to: "/reviews", badge: dueReviews },
      ],
    },
    {
      heading: "Practice",
      items: [
        { label: "Drills", icon: Zap, to: "/drills" },
        { label: "Integrals", icon: Sigma, to: "/integrals" },
        { label: "Question bank", icon: Library, to: "/question-bank" },
        { label: "Resources", icon: BookOpen, to: "/resource-bank" },
        { label: "Analytics", icon: BarChart3, to: "/analytics" },
      ],
    },
  ];
}

interface AppShellProps {
  children: ReactNode;
  /**
   * Focus mode: hide the chrome so a deep session owns the full canvas. The nav is still one
   * gesture away (hover the left edge, or press \) rather than gone — being stranded with no way
   * out is the bug this shell exists to fix, so focus must never become a trap.
   */
  focusMode?: boolean;
}

export default function AppShell({ children, focusMode = false }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const dueReviews = useDueReviewCount();
  const groups = useNavGroups(dueReviews);

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Focus mode escape hatch: `\` toggles the nav back into view without leaving the session.
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing) return;
      if (e.key === "\\") {
        e.preventDefault();
        setPeek((v) => !v);
      }
      if (e.key === "Escape") setPeek(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const go = (item: NavItem) => {
    navigate(item.to);
    setMobileOpen(false);
    if (focusMode) setPeek(false);
  };

  const isCurrent = (item: NavItem) =>
    item.match ? item.match(location.pathname) : location.pathname.startsWith(item.to);

  const streak = profile?.weekly_streak ?? 0;
  const points = profile?.total_xp ?? 0;

  /* ── Nav list, shared by the desktop rail and the mobile drawer ─────────────────── */
  const NavList = ({ iconOnly }: { iconOnly: boolean }) => (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.heading && !iconOnly && <p className="micro-label mb-1.5 px-2.5">{group.heading}</p>}
          {group.heading && iconOnly && <div className="mx-auto mb-1.5 h-px w-5 bg-border" />}
          {group.items.map((item) => {
            const current = isCurrent(item);
            const button = (
              <button
                key={item.label}
                onClick={() => go(item)}
                aria-current={current ? "page" : undefined}
                className={`group relative flex h-9 items-center rounded-lg text-[13.5px] font-medium transition-colors ${
                  iconOnly ? "w-9 justify-center self-center" : "w-full gap-2.5 px-2.5"
                } ${
                  current
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {/* Current-page marker: a hairline on the rail edge, not a heavy fill. */}
                {current && (
                  <span className="absolute -left-3 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" aria-hidden />
                )}
                <item.icon className={`h-[16px] w-[16px] shrink-0 ${current ? "text-primary" : ""}`} />
                {!iconOnly && <span className="truncate">{item.label}</span>}
                {!!item.badge && item.badge > 0 && (
                  <span
                    className={`readout flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ${
                      iconOnly ? "absolute -right-0.5 -top-0.5" : "ml-auto"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
            return iconOnly ? (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                  {!!item.badge && item.badge > 0 && ` — ${item.badge} due`}
                </TooltipContent>
              </Tooltip>
            ) : (
              button
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        <button
          onClick={() => {
            navigate("/settings");
            setMobileOpen(false);
          }}
          className={`flex h-9 items-center rounded-lg text-[13.5px] font-medium transition-colors ${
            iconOnly ? "w-9 justify-center self-center" : "w-full gap-2.5 px-2.5"
          } ${
            location.pathname.startsWith("/settings")
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          <SettingsIcon className="h-[16px] w-[16px] shrink-0" />
          {!iconOnly && <span>Settings</span>}
        </button>
      </div>
    </nav>
  );

  const showRail = !focusMode || peek;

  return (
    <div className="relative min-h-screen bg-background">
      {/* ── Top bar: identity, readouts, account ───────────────────────────────────── */}
      {!focusMode && (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <button onClick={() => navigate("/dashboard")} className="group flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-[16px] font-semibold tracking-[-0.02em] text-foreground">
              Cortexed<span className="text-primary">.</span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Sits before the readouts because it is the only control here you reach FOR — the
                streak and points are things you glance at, not things you press. */}
            <AssistantPalette />
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`hidden h-8 cursor-default items-center gap-1.5 rounded-full border border-border bg-accent/40 px-2.5 sm:flex ${
                    streak > 0 ? "text-streak" : "text-muted-foreground"
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span className="readout text-[12.5px] text-foreground/80">{streak}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Day streak</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden h-8 cursor-default items-center gap-1.5 rounded-full border border-border bg-accent/40 px-2.5 text-muted-foreground sm:flex">
                  <Trophy className="h-3.5 w-3.5" />
                  <span className="readout text-[12.5px] text-foreground/80">{points}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Mastery points</TooltipContent>
            </Tooltip>

            <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

            <SafeBoundary label="Appearance" compact>
              <CustomizeMenu />
            </SafeBoundary>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  aria-label="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <LogOut className="h-[17px] w-[17px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Sign out</TooltipContent>
            </Tooltip>
          </div>
        </header>
      )}

      <div className="flex">
        {/* ── Desktop rail ─────────────────────────────────────────────────────────── */}
        {/* Position is set in exactly ONE branch. The previous version applied `sticky` unconditionally
            and added `fixed` on top of it for focus mode — and Tailwind emits `sticky` AFTER `fixed`,
            so `sticky` won. The rail therefore stayed in normal flow at its full width during a
            session, reserving a blank 212px (68px collapsed) gutter down the left of the canvas while
            `-translate-x-full` slid only its CONTENTS out of view. Focus mode must take the rail out
            of flow entirely, or "focus" costs the student a sixth of the screen for nothing. */}
        <aside
          className={`z-30 hidden shrink-0 flex-col border-r border-border bg-background/60 backdrop-blur-xl transition-[width] duration-200 lg:flex ${
            focusMode
              ? `fixed left-0 top-0 h-screen transition-transform duration-200 ${
                  peek ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                }`
              : "sticky top-14 h-[calc(100vh-3.5rem)]"
          } ${collapsed ? "w-[68px]" : "w-[212px]"}`}
          aria-hidden={focusMode && !peek}
        >
          <NavList iconOnly={collapsed} />
          {/* Stays at the foot of the rail (the user's call). The only change is the tooltip: every
              other control in a collapsed rail has one, and this was the one unlabelled icon that
              had to be guessed at. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
                className="mx-3 mb-3 flex h-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </aside>

        {/* Focus-mode hover strip: brushing the left edge brings the rail back. */}
        {focusMode && !peek && (
          <div
            className="fixed left-0 top-0 z-20 hidden h-screen w-3 lg:block"
            onMouseEnter={() => setPeek(true)}
            aria-hidden
          />
        )}
        {focusMode && peek && (
          <div className="fixed inset-0 z-20 hidden lg:block" onClick={() => setPeek(false)} aria-hidden />
        )}

        {/* `key` on the pathname remounts this wrapper on every navigation, so the 180ms fade
            replays per route. Without it the app cut between Home / Concepts / Map / Reviews with
            no transition at all — four destinations under one rail that read as four unrelated
            apps. Opacity only, and short, because this runs on every navigation. */}
        <main key={location.pathname} className="reveal-page min-w-0 flex-1">
          {children}
        </main>
      </div>

      {/* ── Mobile drawer — the fix for controls being unreachable on a phone ───────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[264px] flex-col p-0">
          <SheetHeader className="border-b border-border px-4 py-3.5">
            <SheetTitle className="flex items-center gap-2.5">
              <BrandMark />
              <span className="font-display text-[16px] font-semibold tracking-[-0.02em]">
                Cortexed<span className="text-primary">.</span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <NavList iconOnly={false} />
          <div className="border-t border-border px-3 py-3">
            <button
              onClick={signOut}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <LogOut className="h-[16px] w-[16px]" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
