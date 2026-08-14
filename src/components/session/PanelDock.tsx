import type { LucideIcon } from "lucide-react";

export interface DockItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  items: DockItem[];
  onRestore: (id: string) => void;
  /** Distance from the bottom of the frame — the command bar's height, so the dock clears it. */
  bottom: number;
}

/**
 * Where put-away panels live.
 *
 * A panel you can close but not find again is a panel you stop closing, so nothing ever gets out of
 * the way. The dock makes minimising safe: the panel leaves the workspace completely, and the
 * single click that brings it back is always in the same place, showing exactly what is waiting.
 * Absent entirely when nothing is minimised — an empty tray is just more chrome.
 */
export default function PanelDock({ items, onRestore, bottom }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      style={{ bottom }}
      data-dock
      className="pointer-events-auto absolute left-4 z-30 flex items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 shadow-lg backdrop-blur-xl"
    >
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onRestore(id)}
          title={`Bring back ${label}`}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          {label}
        </button>
      ))}
    </div>
  );
}
