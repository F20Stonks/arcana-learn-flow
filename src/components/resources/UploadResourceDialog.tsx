import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Globe, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { KIND_OPTIONS, type ResourceKind, type ResourceVisibility } from "@/lib/resources";

interface UploadResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onUploaded: () => void;
}

const MAX_BYTES = 100 * 1024 * 1024; // Matches the bucket's file_size_limit — fail here, with a message.

type Stage = "idle" | "uploading" | "indexing" | "done";

export default function UploadResourceDialog({
  open, onOpenChange, isAdmin, onUploaded,
}: UploadResourceDialogProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [kind, setKind] = useState<ResourceKind>("book");
  const [subject, setSubject] = useState("");
  const [visibility, setVisibility] = useState<ResourceVisibility>("private");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = stage === "uploading" || stage === "indexing";

  function reset() {
    setFile(null); setTitle(""); setAuthor(""); setKind("book"); setSubject("");
    setVisibility("private"); setStage("idle"); setProgress(0);
  }

  function pickFile(f: File | null) {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("That file is over the 100 MB limit.");
      return;
    }
    setFile(f);
    // Filenames are usually the best title available, minus the extension and the underscores that
    // survive every download. The student can still correct it before uploading.
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim());
    }
  }

  async function handleUpload() {
    if (!file || !user || !title.trim()) return;

    setStage("uploading");
    setProgress(5);

    // The path's first segment is the user id, which is what the storage RLS policy checks. Even a
    // global document is stored under the uploader — provenance, and one policy instead of two.
    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("user-resources")
      .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });

    if (uploadError) {
      setStage("idle");
      toast.error(`Upload failed: ${uploadError.message}`);
      return;
    }

    setProgress(35);

    const { data: inserted, error: insertError } = await (supabase.from("resources" as never) as any)
      .insert({
        title: title.trim(),
        author: author.trim() || null,
        kind,
        subject: subject.trim() || null,
        visibility,
        // A global document has no owner: that is precisely what makes its chunks readable by everyone
        // in match_resource_chunks, which filters on `owner_id IS NULL OR owner_id = caller`.
        owner_id: visibility === "global" ? null : user.id,
        created_by: user.id,
        storage_bucket: "user-resources",
        storage_path: path,
        content_type: file.type || "application/pdf",
        byte_size: file.size,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // The row is the record; an orphaned object with no row is invisible and unreclaimable, so it goes.
      await supabase.storage.from("user-resources").remove([path]);
      setStage("idle");
      toast.error(`Couldn't save that document: ${insertError?.message ?? "unknown error"}`);
      return;
    }

    // --- Index in the browser. Deno cannot parse a PDF, but this tab already can.
    setStage("indexing");
    setProgress(40);

    try {
      // Imported here, not at module scope: pdf.js is ~1.2 MB, and this dialog is mounted on the
      // Resources page for everyone who visits it. A static import would put the whole engine in the
      // main bundle for every page load in the app, to serve the one moment someone uploads a file.
      const { loadPdf, extractChunks } = await import("@/lib/pdf");
      const buffer = await file.arrayBuffer();
      const pdf = await loadPdf(buffer);
      const chunks = await extractChunks(pdf, (page, total) => {
        setProgress(40 + Math.round((page / total) * 45));
      });
      const pageCount = pdf.numPages;
      await pdf.destroy();

      setProgress(90);

      const { error: indexError } = await supabase.functions.invoke("index-resource", {
        body: { resourceId: inserted.id, chunks, pageCount },
      });
      if (indexError) throw indexError;

      setProgress(100);
      setStage("done");
      toast.success(
        chunks.length > 0
          ? `"${title.trim()}" added and indexed — the tutor can quote it now.`
          : `"${title.trim()}" added. No text layer found, so it's readable but not searchable.`,
      );
    } catch (e) {
      // The document is uploaded and openable; only search is missing. Failing the whole upload here
      // would throw away the part that worked.
      console.error("Indexing failed:", e);
      setProgress(100);
      setStage("done");
      toast.warning(`"${title.trim()}" was uploaded, but couldn't be indexed for AI search.`);
    }

    onUploaded();
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Upload a PDF to read in-app. Its text is indexed so you can ask about any page — and you can
            attach it to a track so the tutor teaches from it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div
            onClick={() => !busy && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            {file ? (
              <>
                <FileText className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm">Drop a PDF here, or click to choose</span>
                <span className="text-xs text-muted-foreground">Up to 100 MB</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="res-title">Title</Label>
              <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Introduction to Real Analysis" disabled={busy} />
            </div>
            <div>
              <Label htmlFor="res-author">Author</Label>
              <Input id="res-author" value={author} onChange={(e) => setAuthor(e.target.value)}
                placeholder="Bartle & Sherbert" disabled={busy} />
            </div>
            <div>
              <Label htmlFor="res-subject">Subject</Label>
              <Input id="res-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Mathematics" disabled={busy} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ResourceKind)} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div>
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as ResourceVisibility)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Private to me</span>
                    </SelectItem>
                    <SelectItem value="global">
                      <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Shared library</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!isAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Private to you. Nobody else can see or search it.
            </p>
          )}

          {busy && (
            <div className="space-y-1.5">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                {stage === "uploading" ? "Uploading…" : "Reading the text so the AI can search it…"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || !title.trim() || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
