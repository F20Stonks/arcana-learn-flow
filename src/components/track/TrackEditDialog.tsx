import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Undo2, EyeOff, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface EditableTopic {
  id: string;
  title: string;
  archived_at: string | null;
  subtopicCount: number;
  completedCount: number;
}

interface TrackEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  trackTitle: string;
  trackSubject: string | null;
  topics: EditableTopic[];
  onSaved: () => void;
}

/**
 * Rename a track, and cut it down to size.
 *
 * WHY ARCHIVE RATHER THAN DELETE A TOPIC: generated tracks routinely come out longer than the student
 * actually needs, and the honest response to "this is too long" is to let them put topics aside — not to
 * destroy the subtopics, sessions and progress underneath them. archived_at already carries exactly this
 * meaning for elective option groups, and TrackOverview already filters on it, so trimming is a flag flip
 * that every other surface understands for free and that the student can undo.
 */
export default function TrackEditDialog({
  open, onOpenChange, trackId, trackTitle, trackSubject, topics, onSaved,
}: TrackEditDialogProps) {
  const [title, setTitle] = useState(trackTitle);
  const [subject, setSubject] = useState(trackSubject ?? "");
  const [local, setLocal] = useState<EditableTopic[]>(topics);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed from props each time the dialog opens: leaving stale edits behind from a previous open is
  // how a student ends up renaming a track they already renamed.
  useEffect(() => {
    if (open) {
      setTitle(trackTitle);
      setSubject(trackSubject ?? "");
      setLocal(topics);
      setRenamingId(null);
    }
  }, [open, trackTitle, trackSubject, topics]);

  const activeCount = local.filter((t) => !t.archived_at).length;
  const activeSubs = local.filter((t) => !t.archived_at).reduce((a, t) => a + t.subtopicCount, 0);

  function toggleArchive(id: string) {
    setLocal((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, archived_at: t.archived_at ? null : new Date().toISOString() } : t,
      ),
    );
  }

  function commitRename(id: string) {
    const value = renameValue.trim();
    if (value) setLocal((prev) => prev.map((t) => (t.id === id ? { ...t, title: value } : t)));
    setRenamingId(null);
  }

  async function save() {
    if (!title.trim()) {
      toast.error("A track needs a title.");
      return;
    }
    setSaving(true);

    const { error: trackErr } = await supabase
      .from("learning_tracks")
      .update({ title: title.trim(), subject: subject.trim() || null })
      .eq("id", trackId);

    if (trackErr) {
      setSaving(false);
      toast.error("Couldn't rename the track.");
      return;
    }

    // Only write topics that actually changed. A track can carry hundreds, and updating every row on
    // every save turns a rename into a few hundred pointless writes.
    const changed = local.filter((t) => {
      const original = topics.find((o) => o.id === t.id);
      return original && (original.title !== t.title || original.archived_at !== t.archived_at);
    });

    for (const topic of changed) {
      const { error } = await (supabase.from("topics" as never) as any)
        .update({ title: topic.title, archived_at: topic.archived_at })
        .eq("id", topic.id);
      if (error) {
        setSaving(false);
        toast.error(`Couldn't update "${topic.title}".`);
        return;
      }
    }

    setSaving(false);
    toast.success(changed.length ? "Track updated." : "Track renamed.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit track</DialogTitle>
          <DialogDescription>
            Rename it, or hide topics you don't need. Hidden topics keep their progress and can be
            brought back at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="track-title">Track name</Label>
            <Input id="track-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="track-subject">Subject</Label>
            <Input id="track-subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} />
          </div>
        </div>

        <Separator className="my-1" />

        <div className="flex items-center justify-between">
          <Label>Topics</Label>
          <span className="text-xs text-muted-foreground">
            {activeCount} of {local.length} topics · {activeSubs} subtopics
          </span>
        </div>

        <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {local.map((topic) => {
            const archived = !!topic.archived_at;
            return (
              <div
                key={topic.id}
                className={`flex items-center gap-2 rounded-md border p-2 transition-colors ${
                  archived ? "border-dashed bg-muted/40 opacity-60" : "bg-card"
                }`}
              >
                {renamingId === topic.id ? (
                  <>
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(topic.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      autoFocus
                      className="h-8 flex-1 text-sm"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => commitRename(topic.id)} aria-label="Save name">
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenamingId(null)} aria-label="Cancel rename">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 truncate text-sm ${archived ? "line-through" : ""}`}>
                      {topic.title}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {topic.completedCount}/{topic.subtopicCount}
                    </Badge>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { setRenamingId(topic.id); setRenameValue(topic.title); }}
                      aria-label={`Rename ${topic.title}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => toggleArchive(topic.id)}
                      aria-label={archived ? `Restore ${topic.title}` : `Hide ${topic.title}`}
                      title={archived ? "Bring this topic back" : "Hide this topic"}
                    >
                      {archived ? <Undo2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
