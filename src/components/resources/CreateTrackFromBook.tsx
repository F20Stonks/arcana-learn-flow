import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Resource } from "@/lib/resources";
import type { BookChapter } from "@/lib/bookStructure";

interface CreateTrackFromBookProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource;
  fileUrl: string;
}

/**
 * "Make a track from this book."
 *
 * The structure comes from the PDF's own outline, so chapters become topics, sections become subtopics,
 * and every subtopic carries the page range it covers. That last part is what ties the two progress
 * notions together: reading to page 78 and completing "Sequences and Their Limits" become the same fact,
 * rather than two bars that drift apart.
 */
export default function CreateTrackFromBook({
  open, onOpenChange, resource, fileUrl,
}: CreateTrackFromBookProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<BookChapter[] | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState(resource.title);
  const [scanning, setScanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [noOutline, setNoOutline] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setScanning(true);
      setNoOutline(false);
      setTitle(resource.title);
      try {
        const [{ loadPdf }, { extractBookStructure }] = await Promise.all([
          import("@/lib/pdf"),
          import("@/lib/bookStructure"),
        ]);
        const pdf = await loadPdf(fileUrl);
        const structure = await extractBookStructure(pdf);
        await pdf.destroy();
        if (cancelled) return;
        if (!structure?.length) setNoOutline(true);
        setChapters(structure);
        setSkipped(new Set());
      } catch (e) {
        if (!cancelled) {
          console.error("Couldn't read the book's structure:", e);
          setNoOutline(true);
        }
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, fileUrl, resource.title]);

  const included = (chapters ?? []).filter((_, i) => !skipped.has(i));
  const subtopicCount = included.reduce((a, c) => a + Math.max(c.sections.length, 1), 0);

  async function create() {
    if (!user || !included.length) return;
    setCreating(true);

    const { data: track, error: trackErr } = await supabase
      .from("learning_tracks")
      .insert({
        user_id: user.id,
        title: title.trim() || resource.title,
        subject: resource.subject || "Mathematics",
        level: resource.level,
      })
      .select("id")
      .single();

    if (trackErr || !track) {
      setCreating(false);
      toast.error("Couldn't create the track.");
      return;
    }

    try {
      for (const [index, chapter] of included.entries()) {
        const { data: topic, error: topicErr } = await (supabase.from("topics" as never) as any)
          .insert({ track_id: track.id, title: chapter.title, order_index: index, status: "not_started" })
          .select("id")
          .single();
        if (topicErr || !topic) throw topicErr ?? new Error("topic insert failed");

        // A chapter with no sections still becomes one subtopic covering the whole chapter — otherwise a
        // flat-outline book would produce topics containing nothing to study.
        const sections = chapter.sections.length
          ? chapter.sections
          : [{ title: chapter.title, pageStart: chapter.pageStart, pageEnd: chapter.pageEnd }];

        const { error: subErr } = await (supabase.from("subtopics" as never) as any).insert(
          sections.map((s, i) => ({
            topic_id: topic.id,
            title: s.title,
            order_index: i,
            status: "not_started",
            resource_id: resource.id,
            page_start: s.pageStart,
            page_end: s.pageEnd,
          })),
        );
        if (subErr) throw subErr;
      }

      // Attach the book so the tutor teaches FROM it, not merely alongside it.
      await (supabase.from("track_resources" as never) as any).insert({
        track_id: track.id,
        resource_id: resource.id,
        added_by: user.id,
        note: "Course text this track was generated from.",
      });

      toast.success(`Created "${title.trim()}" — ${included.length} topics, ${subtopicCount} subtopics.`);
      onOpenChange(false);
      navigate(`/track/${track.id}`);
    } catch (e) {
      console.error("Track build failed:", e);
      // A half-built track is worse than none: it looks complete and silently misses chapters.
      await supabase.from("learning_tracks").delete().eq("id", track.id);
      toast.error("Couldn't build the track from this book.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && onOpenChange(o)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Make a track from this book</DialogTitle>
          <DialogDescription>
            Chapters become topics and sections become subtopics, each tied to its pages — so reading
            the book and working the track are the same progress.
          </DialogDescription>
        </DialogHeader>

        {scanning ? (
          <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the book's contents…
          </div>
        ) : noOutline ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">This PDF has no table of contents</p>
            <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">
              It carries no embedded outline, so there's no reliable structure to read — this is normal
              for scans and short booklets. Build a track the usual way and attach this book to it
              instead.
            </p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="book-track-title">Track name</Label>
              <Input
                id="book-track-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Chapters</Label>
              <span className="text-xs text-muted-foreground">
                {included.length} topics · {subtopicCount} subtopics
              </span>
            </div>

            <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
              {(chapters ?? []).map((chapter, i) => {
                const on = !skipped.has(i);
                return (
                  <label
                    key={`${chapter.title}-${chapter.pageStart}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      on ? "bg-card" : "border-dashed bg-muted/40 opacity-60"
                    }`}
                  >
                    <Checkbox
                      checked={on}
                      className="mt-0.5"
                      onCheckedChange={() =>
                        setSkipped((prev) => {
                          const next = new Set(prev);
                          next.has(i) ? next.delete(i) : next.add(i);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-medium ${on ? "" : "line-through"}`}>
                          {chapter.title}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          pp. {chapter.pageStart}–{chapter.pageEnd}
                        </Badge>
                      </div>
                      {chapter.sections.length > 0 && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {chapter.sections.map((s) => s.title).join(" · ")}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={create} disabled={creating || scanning || noOutline || !included.length}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
            Create track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
