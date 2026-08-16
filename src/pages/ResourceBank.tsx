import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import UploadResourceDialog from "@/components/resources/UploadResourceDialog";
import {
  BookOpen, Search, Upload, Globe, Lock, MoreVertical, Trash2, FileText, Sparkles, Library,
} from "lucide-react";
import { toast } from "sonner";
import {
  KIND_LABEL, KIND_OPTIONS, formatBytes, readPercent,
  type Resource, type ResourceProgress,
} from "@/lib/resources";

type Scope = "all" | "global" | "mine";

export default function ResourceBank() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resources, setResources] = useState<Resource[]>([]);
  const [progress, setProgress] = useState<Record<string, ResourceProgress>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // RLS already restricts this to global rows plus the caller's own — the scope tabs below filter what
    // is visible, they are not the security boundary.
    const [{ data: rows, error }, { data: prog }, { data: adminFlag }] = await Promise.all([
      (supabase.from("resources" as never) as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("resource_progress" as never) as any).select("resource_id, last_page, furthest_page, updated_at"),
      supabase.rpc("is_admin" as never, { p_user: user.id } as never),
    ]);

    if (error) {
      console.error("Couldn't load resources:", error);
      toast.error("Couldn't load your resources.");
    }

    setResources((rows as Resource[]) ?? []);
    setProgress(
      Object.fromEntries(((prog as ResourceProgress[]) ?? []).map((p) => [p.resource_id, p])),
    );
    setIsAdmin(adminFlag === true);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);

    const { error } = await (supabase.from("resources" as never) as any).delete().eq("id", target.id);
    if (error) {
      toast.error("Couldn't delete that document.");
      return;
    }
    // Chunks and progress cascade from the row; the stored file does not, so it goes explicitly.
    await supabase.storage.from(target.storage_bucket).remove([target.storage_path]);
    toast.success(`Deleted "${target.title}".`);
    void load();
  }

  const visible = resources.filter((r) => {
    if (scope === "global" && r.visibility !== "global") return false;
    if (scope === "mine" && r.owner_id !== user?.id) return false;
    if (kindFilter !== "all" && r.kind !== kindFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${r.title} ${r.author ?? ""} ${r.subject ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const mineCount = resources.filter((r) => r.owner_id === user?.id).length;
  const globalCount = resources.filter((r) => r.visibility === "global").length;

  return (
    <AppShell>
      <div className="container mx-auto max-w-7xl animate-in p-6 duration-500 fade-in">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Resources</h1>
            <p className="mt-1 text-muted-foreground">
              Books and papers you can read in-app — ask the AI about any page, or attach one to a track.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/question-bank")}>
              <Library className="mr-2 h-4 w-4" /> Question bank
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Add document
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center">
          <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)} className="shrink-0">
            <TabsList>
              <TabsTrigger value="all">All ({resources.length})</TabsTrigger>
              <TabsTrigger value="global">Shared ({globalCount})</TabsTrigger>
              <TabsTrigger value="mine">Mine ({mineCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title, author or subject…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="md:w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {KIND_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-4">
                  <Skeleton className="mb-2 h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent><Skeleton className="h-16 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 py-20 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">
              {resources.length === 0 ? "No documents yet" : "Nothing matches those filters"}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              {resources.length === 0
                ? "Upload a textbook, past paper or set of notes. Its text gets indexed so you can ask about any page."
                : "Try a different search or type."}
            </p>
            {resources.length === 0 && (
              <Button className="mt-6" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Add your first document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((res) => {
              const prog = progress[res.id];
              const pct = readPercent(prog, res.page_count);
              const canManage = res.owner_id === user?.id || isAdmin;

              return (
                <Card
                  key={res.id}
                  className="group flex cursor-pointer flex-col transition-colors hover:border-primary/50"
                  onClick={() => navigate(`/resource/${res.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{KIND_LABEL[res.kind]}</Badge>
                        {res.visibility === "global" ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Globe className="h-2.5 w-2.5" /> Shared
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Lock className="h-2.5 w-2.5" /> Private
                          </Badge>
                        )}
                        {res.text_status === "indexed" && (
                          <Badge variant="outline" className="gap-1 border-primary/30 text-[10px] text-primary">
                            <Sparkles className="h-2.5 w-2.5" /> Searchable
                          </Badge>
                        )}
                      </div>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button
                              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label="Document options"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setTimeout(() => setPendingDelete(res), 0)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <CardTitle className="text-lg leading-tight transition-colors group-hover:text-primary">
                      {res.title}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {res.author && <span>{res.author}</span>}
                      {res.subject && <span className="text-muted-foreground/60">· {res.subject}</span>}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-end gap-3">
                    {pct !== null && (
                      <div className="space-y-1">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {pct}% · continue on page {prog?.last_page}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        {res.page_count ? `${res.page_count} pages` : formatBytes(res.byte_size)}
                      </span>
                      {res.text_status === "no_text_layer" && (
                        <span title="This looks like a scan — no text to search">Not searchable</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <UploadResourceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isAdmin={isAdmin}
        onUploaded={load}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the file, its search index and your reading progress. Any track it's attached
              to will lose it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
