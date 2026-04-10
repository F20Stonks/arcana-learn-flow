import { useState } from "react";
import { ChevronRight, BookOpen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Track } from "@/data/learningTracks";
import { StatusDot } from "./StatusDot";

export function LearningSidebar({
  track,
  activeSubtopic,
  onSelectSubtopic,
  onBack,
}: {
  track: Track;
  activeSubtopic: string;
  onSelectSubtopic: (id: string, title: string) => void;
  onBack: () => void;
}) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(
    new Set(track.topics.map((t) => t.id))
  );

  const toggleTopic = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-sidebar flex flex-col h-screen">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Jarvis</span>
        </div>
      </div>

      <button
        onClick={onBack}
        className="flex items-center gap-2 px-5 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors border-b border-border"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>All Tracks</span>
      </button>

      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">{track.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{track.title}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-3">
        {track.topics.map((topic) => {
          const isTopicOpen = expandedTopics.has(topic.id);
          return (
            <div key={topic.id} className="mb-0.5">
              <button
                onClick={() => toggleTopic(topic.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform",
                    isTopicOpen && "rotate-90"
                  )}
                />
                <StatusDot status={topic.status} />
                <span>{topic.title}</span>
              </button>

              {isTopicOpen && (
                <div className="ml-5 mt-0.5">
                  {topic.subtopics.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => onSelectSubtopic(sub.id, sub.title)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                        activeSubtopic === sub.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <StatusDot status={sub.status} />
                      <span>{sub.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
            A
          </div>
          <div className="text-sm">
            <p className="font-medium text-foreground leading-none">Alex</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">3 tracks active</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
