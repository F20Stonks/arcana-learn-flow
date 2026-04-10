import { useState } from "react";
import { ChevronRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { learningTracks } from "@/data/learningTracks";
import { StatusDot } from "./StatusDot";

export function LearningSidebar({
  activeSubtopic,
  onSelectSubtopic,
}: {
  activeSubtopic: string;
  onSelectSubtopic: (id: string, title: string) => void;
}) {
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set(["ml"]));
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(["ml-2"]));

  const toggleTrack = (id: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

      <div className="flex-1 overflow-y-auto py-3 px-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-2 mb-2">
          Learning Tracks
        </p>

        {learningTracks.map((track) => {
          const isTrackOpen = expandedTracks.has(track.id);
          return (
            <div key={track.id} className="mb-1">
              <button
                onClick={() => toggleTrack(track.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isTrackOpen && "rotate-90")}
                />
                <span className="mr-1">{track.emoji}</span>
                <span className="font-medium text-foreground">{track.title}</span>
              </button>

              {isTrackOpen && (
                <div className="ml-4 border-l border-border pl-2 mt-0.5">
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
