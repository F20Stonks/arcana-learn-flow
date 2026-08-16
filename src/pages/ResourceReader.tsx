import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PdfViewer from "@/components/resources/PdfViewer";
import ResourceAssistant from "@/components/resources/ResourceAssistant";
import CreateTrackFromBook from "@/components/resources/CreateTrackFromBook";
import { getResourceUrl, KIND_LABEL, type Resource } from "@/lib/resources";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sparkles,
  Bookmark, Download, Globe, Lock, PanelRightClose, GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

const ZOOM_STEPS = [0.6, 0.75, 0.9, 1.1, 1.3, 1.6, 2.0, 2.5];

export default function ResourceReader() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [numPages, setNumPages] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(3);
  const [pageText, setPageText] = useState("");
  const [selection, setSelection] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [makingTrack, setMakingTrack] = useState(false);

  const furthestRef = useRef(1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Load the document, its signed URL, and where the reader left off.
  useEffect(() => {
    if (!resourceId || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error: err } = await (supabase.from("resources" as never) as any)
        .select("*")
        .eq("id", resourceId)
        .maybeSingle();

      if (cancelled) return;
      // RLS renders anything unreadable as absent, so "not found" covers both cases correctly.
      if (err || !data) {
        setError("This document doesn't exist, or you don't have access to it.");
        setLoading(false);
        return;
      }
      setResource(data as Resource);

      try {
        setFileUrl(await getResourceUrl(data as Resource));
      } catch {
        if (!cancelled) setError("Couldn't open the file for this document.");
      }

      const { data: progress } = await (supabase.from("resource_progress" as never) as any)
        .select("last_page, furthest_page")
        .eq("resource_id", resourceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        furthestRef.current = progress?.furthest_page ?? progress?.last_page ?? 1;
        // ?page=N wins over the saved position: it means something deliberately sent the reader HERE —
        // a subtopic opening the pages it teaches, or a bookmark — and silently landing them somewhere
        // else instead would make those links look broken.
        const requested = Number(searchParams.get("page"));
        const target = Number.isFinite(requested) && requested >= 1 ? requested : progress?.last_page;
        if (target) {
          setPage(target);
          setPageInput(String(target));
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [resourceId, user]);

  // --- Persist position, debounced. Flicking through 30 pages should cost one write, not thirty.
  useEffect(() => {
    if (!resourceId || !user || loading) return;
    furthestRef.current = Math.max(furthestRef.current, page);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (supabase.from("resource_progress" as never) as any).upsert(
        {
          user_id: user.id,
          resource_id: resourceId,
          last_page: page,
          furthest_page: furthestRef.current,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,resource_id" },
      );
    }, 1200);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [page, resourceId, user, loading]);

  const goToPage = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 1), numPages || next);
    setPage(clamped);
    setPageInput(String(clamped));
  }, [numPages]);

  // --- Keyboard paging, but never while the reader is typing a question.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goToPage(page + 1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goToPage(page - 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, goToPage]);

  async function addBookmark() {
    if (!resourceId || !user) return;
    const { error: err } = await (supabase.from("resource_bookmarks" as never) as any).insert({
      user_id: user.id,
      resource_id: resourceId,
      page,
      quote: selection ? selection.slice(0, 2000) : null,
    });
    if (err) toast.error("Couldn't save that bookmark.");
    else toast.success(`Bookmarked page ${page}.`);
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="m-4 flex-1" />
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">{error ?? "Document unavailable."}</p>
        <Button variant="outline" onClick={() => navigate("/resource-bank")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to resources
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      {/* Deliberately outside AppShell: a reader wants the full height, and the sidebar competes with the
          document for exactly the horizontal space the assistant panel needs. */}
      <div className="flex h-screen flex-col bg-muted/30">
        <header className="flex shrink-0 items-center gap-3 border-b bg-card px-3 py-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/resource-bank")} aria-label="Back to resources">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{resource.title}</h1>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {KIND_LABEL[resource.kind]}
              </Badge>
              {resource.visibility === "global" ? (
                <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
            </div>
            {resource.author && (
              <p className="truncate text-xs text-muted-foreground">{resource.author}</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const n = parseInt(pageInput, 10);
                if (Number.isFinite(n)) goToPage(n);
                else setPageInput(String(page));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-8 w-14 text-center text-xs"
              aria-label="Page number"
            />
            <span className="text-xs text-muted-foreground">/ {numPages || "…"}</span>
            <Button variant="ghost" size="icon" onClick={() => goToPage(page + 1)} disabled={!!numPages && page >= numPages} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border-l pl-2">
            <Button variant="ghost" size="icon" onClick={() => setZoomIndex((i) => Math.max(0, i - 1))} disabled={zoomIndex === 0} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-10 text-center text-xs text-muted-foreground">
              {Math.round(ZOOM_STEPS[zoomIndex] * 100)}%
            </span>
            <Button variant="ghost" size="icon" onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))} disabled={zoomIndex === ZOOM_STEPS.length - 1} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 border-l pl-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setMakingTrack(true)} aria-label="Make a track from this book">
                  <GraduationCap className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Make a track from this book</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={addBookmark} aria-label="Bookmark this page">
                  <Bookmark className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bookmark page {page}</TooltipContent>
            </Tooltip>
            {fileUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild aria-label="Open the original PDF">
                    <a href={fileUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open original</TooltipContent>
              </Tooltip>
            )}
            <Button
              variant={assistantOpen ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setAssistantOpen((v) => !v)}
              aria-label={assistantOpen ? "Hide the assistant" : "Ask about this document"}
            >
              {assistantOpen ? <PanelRightClose className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-auto">
            {fileUrl && (
              <PdfViewer
                url={fileUrl}
                page={page}
                zoom={ZOOM_STEPS[zoomIndex]}
                onDocumentLoad={setNumPages}
                onPageText={(_p, text) => setPageText(text)}
                onSelectionChange={setSelection}
                onError={(m) => toast.error(m)}
              />
            )}
          </main>

          {assistantOpen && (
            <aside className="hidden w-[380px] shrink-0 lg:block">
              <ResourceAssistant
                resourceId={resource.id}
                page={page}
                pageText={pageText}
                selection={selection}
                onClearSelection={() => setSelection("")}
              />
            </aside>
          )}
        </div>

        {fileUrl && (
          <CreateTrackFromBook
            open={makingTrack}
            onOpenChange={setMakingTrack}
            resource={resource}
            fileUrl={fileUrl}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
