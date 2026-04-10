import { Target } from "lucide-react";
import { userGoals } from "@/data/learningTracks";

export function GoalsBar() {
  return (
    <div className="border-b border-border bg-card px-6 py-3 flex items-center gap-4">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Target className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wider">Goals</span>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {userGoals.map((goal, i) => (
          <span
            key={i}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground"
          >
            {goal}
          </span>
        ))}
      </div>
    </div>
  );
}
