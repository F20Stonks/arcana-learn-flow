import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Sparkles, AlertTriangle, BookOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABEL, type Resource } from "@/lib/resources";

interface TrackResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  trackTitle: string;
}

/**
 * Choose which documents the tutor may teach from on this track.
 *
 * The searchable/not-searchable distinction is surfaced rather than hidden: attaching a scanned PDF is
 * allowed but does nothing for teaching, because retrieval runs over extracted text. Saying so at the
 * moment of attaching is the difference between a student understanding why the tutor never quotes their
 * book and quietly concluding the feature is broken.
 */
export default function TrackResourcesDialog({
  open, onOpenChange, trackId, trackTitle,
}: TrackResourcesDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!open || !user) return;
    setLoading(true);

    const [{ data: rows }, { data: links }] = await Promise.all([
      (supabase.from("resources" as never) as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("track_resources" as never) as any).select("resource_id").eq("track_id", trackId),
    ]);

    setResources((rows as Resource[]) ?? []);
    const linked = new Set<string>(((links as { resource_id: string }[]) ?? []).map((l) => l.resource_id));
    setAttached(linked);
    setInitial(linked);
    setLoading(false);
  }, [open, user, trackId]);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: string) {
    setAttached((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    if (!user) return;
    setSaving(true);

    const toAdd = [...attached].filter((id) => !initial.has(id));
    const toRemove = [...initial].filter((id) => !attached.has(id));

    if (toAdd.length) {
      const { error } = await (supabase.from("track_resources" as never) as any).insert(
        toAdd.map((resource_id) => ({ track_id: trackId, resource_id, added_by: user.id })),
      );
      if (error) {
        setSaving(false);
        toast.error("Couldn't attach those documents.");
        return;
      }
    }

    if (toRemove.length) {
      const { error } = await (supabase.from("track_resources" as never) as any)
        .delete()
        .eq("track_id", trackId)
        .in("resource_id", toRemove);
      if (error) {
        setSaving(false);
        toast.error("Couldn't detach those documents.");
        return;
      }
    }

    setSaving(false);
    toast.success(
      attached.size === 0
        ? "No documents attached — the tutor will teach from its own knowledge."
        : `${attached.size} document${attached.size === 1 ? "" : "s"} attached to ${trackTitle}.`,
    );
    onOpenChange(false);
  }

  const visible = resources.filter((r) => {
    if (!query.trim()) return true;
    return `${r.title} ${r.author ?? ""} ${r.subject ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Books for this track</DialogTitle>
          <DialogDescription>
            Pick the documents the tutor should teach from. It'll quote them directly in sessions on this
            track, in their notation.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your documents…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {loading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : visible.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {resources.length === 0 ? "You haven't added any documents yet." : "Nothing matches that search."}
              </p>
              {resources.length === 0 && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/resource-bank")}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> Go to Resources
                </Button>
              )}
            </div>
          ) : (
            visible.map((res) => {
              const checked = attached.has(res.id);
              const searchable = res.text_status === "indexed";
              return (
                <label
                  key={res.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                    checked ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40"
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(res.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{res.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[res.author, res.subject, KIND_LABEL[res.kind]].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {searchable ? (
                    <Badge variant="outline" className="shrink-0 gap-1 border-primary/30 text-[10px] text-primary">
                      <Sparkles className="h-2.5 w-2.5" /> {res.chunk_count} passages
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 text-[10px] text-muted-foreground"
                      title="No text layer — the tutor can't quote from this one"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> Not searchable
                    </Badge>
                  )}
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
