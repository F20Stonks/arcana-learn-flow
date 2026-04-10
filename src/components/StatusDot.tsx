import { cn } from "@/lib/utils";
import type { Status } from "@/data/learningTracks";

const statusClasses: Record<Status, string> = {
  completed: "bg-status-green",
  "in-progress": "bg-status-yellow animate-pulse-glow",
  "not-started": "bg-status-red",
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusClasses[status], className)}
      title={status}
    />
  );
}
