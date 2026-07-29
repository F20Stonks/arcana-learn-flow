/**
 * OBSIDIAN INSTRUMENT — learning track card, styled as a "scientific module":
 * faint signature orbit watermark, graphite utilities that stay recessive
 * until engaged, progress ring as the only live/data signal.
 *
 * Ported from the Manus mockup (client/src/components/TrackCard.tsx). Differences from
 * that file, and why:
 *  - `track: LearningTrack` (Manus's fake { name, topics, subtopics, progress } shape) ->
 *    the app's real enriched track record, so `name`->`title`, `topics`->`topicCount`,
 *    `subtopics`->`subtopicCount`, and `progress` is computed from completedCount/subtopicCount
 *    instead of being a stored number.
 *  - Every onClick was a toast() stub. Opening the card, and the Notes/Questions/Papers
 *    chips, now navigate to the real routes. Archive/Delete call back up to Dashboard, which
 *    owns the Supabase mutation and (for delete) the confirmation dialog — a destructive
 *    action shouldn't fire straight from inside the card.
 *  - The subject glyph was a binary Atom/Sigma check. Swapped for lib/subjectIcons.tsx's
 *    keyword-matched set (16 subjects) so a chemistry/CS/econ/etc. track gets its own glyph
 *    instead of falling back to the maths symbol. Kept monochrome/graphite, matching Manus's
 *    file — that component also has a per-subject accent colour available, not used here
 *    since Obsidian's rule is one accent colour (cyan) for the whole app; that's a values
 *    call for the user to make explicitly, not a wiring decision.
 */
import { useNavigate } from "react-router-dom";
import { BookOpen, CircleHelp, FileText, Archive, Trash2 } from "lucide-react";
import ProgressRing from "@/components/ProgressRing";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSubjectIconMeta } from "@/lib/subjectIcons";

export interface TrackCardData {
  id: string;
  title: string;
  subject: string;
  topicCount: number;
  subtopicCount: number;
  completedCount: number;
}

/** Faint orbit-line watermark — the point-mass/orbit brand motif. */
function OrbitWatermark() {
  return (
    <svg
      className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 text-foreground/[0.04] transition-colors duration-300 group-hover:text-primary/[0.09]"
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden>
      <ellipse cx="80" cy="80" rx="72" ry="34" stroke="currentColor" strokeWidth="1" transform="rotate(-24 80 80)" />
      <ellipse cx="80" cy="80" rx="52" ry="22" stroke="currentColor" strokeWidth="1" transform="rotate(-24 80 80)" />
      <circle cx="128" cy="52" r="3" fill="currentColor" />
    </svg>
  );
}

function Chip({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
      {icon}
      {label}
    </button>
  );
}

function HoverAction({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors ${
            danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent hover:text-foreground"
          }`}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function TrackCard({
  track,
  delay,
  onArchive,
  onDelete,
}: {
  track: TrackCardData;
  delay: number;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const isPhysics = track.subject === "physics";
  const SubjectGlyph = getSubjectIconMeta(track.subject).icon;
  const progress = track.subtopicCount > 0 ? Math.round((track.completedCount / track.subtopicCount) * 100) : 0;

  return (
    <div
      className="glass-card glass-card-hover reveal group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl p-5"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => navigate(`/track/${track.id}`)}>
      <OrbitWatermark />
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-accent/50 ${
            isPhysics ? "text-primary/80" : "text-muted-foreground"
          }`}>
          <SubjectGlyph className="h-5 w-5" />
        </div>
        <ProgressRing value={progress} />
      </div>

      <h3 className="font-display mt-4 line-clamp-2 min-h-[42px] text-[15px] font-medium leading-snug tracking-[-0.01em] text-foreground/80 transition-colors group-hover:text-foreground">
        {track.title}
      </h3>
      <p className="readout mt-1.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {track.topicCount} topics · {track.subtopicCount} subtopics
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-0.5 sm:opacity-60 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100">
          <Chip
            icon={<BookOpen className="h-3 w-3" />}
            label="Notes"
            onClick={(e) => { e.stopPropagation(); navigate(`/track/${track.id}/notes`); }}
          />
          <Chip
            icon={<CircleHelp className="h-3 w-3" />}
            label="Questions"
            onClick={(e) => { e.stopPropagation(); navigate(`/track/${track.id}/questions`); }}
          />
          <Chip
            icon={<FileText className="h-3 w-3" />}
            label="Papers"
            onClick={(e) => { e.stopPropagation(); navigate(`/track/${track.id}/papers`); }}
          />
        </div>
        <div className="flex items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <HoverAction label="Archive" onClick={(e) => { e.stopPropagation(); onArchive(); }}>
            <Archive className="h-3.5 w-3.5" />
          </HoverAction>
          <HoverAction label="Delete" danger onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </HoverAction>
        </div>
      </div>
    </div>
  );
}
