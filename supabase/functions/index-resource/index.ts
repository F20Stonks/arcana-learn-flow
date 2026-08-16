// Stores a document's extracted text as retrievable chunks.
//
// WHY THE CLIENT EXTRACTS THE TEXT AND THIS ONLY STORES IT: PDF text extraction cannot run in Deno —
// specResolver.ts records the same finding, and it is why ingest-reference-paper takes pre-extracted text
// from a local Node script rather than parsing anything itself. But the browser CAN parse a PDF, because
// it is already loading pdf.js to display it. So the upload flow extracts per page in the tab that has
// the file open, and this function does the part a browser must never do: write to a service-role table.
//
// That inverts the old constraint pleasantly. Indexing needs no local script, no admin token and no
// scheduled job — a student uploads a book and it is searchable by the time the upload dialog closes.
//
// WHAT THIS FUNCTION MUST NOT TRUST: everything in the body. The caller controls the chunk text, so the
// resource's ownership and visibility are re-read from the database, never taken from the request — that
// is what stops a user indexing content into another user's document, or into the global corpus.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireUser, unauthorized } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// A 600-page textbook chunks to roughly 1,500-2,500 rows. 6,000 leaves generous headroom while still
// bounding what one request can insert.
const MAX_CHUNKS = 6000;
const MAX_CHUNK_CHARS = 4000;
const INSERT_BATCH = 500;

interface IncomingChunk {
  page?: number;
  heading?: string;
  chapter?: string;
  section?: string;
  content?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userId = await requireUser(req);
  if (!userId) return unauthorized(corsHeaders);

  try {
    const body = await req.json();
    const resourceId: string = String(body?.resourceId ?? "");
    const pageCount: number | null = Number.isFinite(body?.pageCount) ? Number(body.pageCount) : null;
    const incoming: IncomingChunk[] = Array.isArray(body?.chunks) ? body.chunks : [];

    if (!resourceId) {
      return new Response(JSON.stringify({ error: "resourceId is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // Read through RLS. A resource the caller may not read comes back as "not found", and a resource
    // they may read but not write is caught by the ownership check below.
    const { data: resource, error: readErr } = await asUser
      .from("resources")
      .select("id, title, subject, visibility, owner_id, license_note")
      .eq("id", resourceId)
      .maybeSingle();

    if (readErr || !resource) {
      return new Response(JSON.stringify({ error: "Document not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Writing chunks is a write to the document. Owning it is the private case; the global case needs
    // admin, checked in the database rather than inferred from visibility.
    let mayWrite = resource.owner_id === userId;
    if (!mayWrite) {
      const { data: isAdmin } = await asUser.rpc("is_admin", { p_user: userId });
      mayWrite = isAdmin === true;
    }
    if (!mayWrite) {
      return new Response(JSON.stringify({ error: "You can't index this document." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const clean = incoming
      .map((c) => ({
        resource_id: resourceId,
        // Global documents have no owner, which is exactly what makes their chunks retrievable by
        // everyone in match_resource_chunks. Taken from the DB row, never from the request.
        owner_id: resource.owner_id,
        source: resource.visibility === "global" ? "global-library" : "own-upload",
        book: resource.title,
        subject: resource.subject || "General",
        chapter: typeof c.chapter === "string" ? c.chapter.slice(0, 300) : null,
        section: typeof c.section === "string" ? c.section.slice(0, 300) : null,
        heading: typeof c.heading === "string" ? c.heading.slice(0, 300) : null,
        page: Number.isFinite(c.page) ? Number(c.page) : null,
        content: String(c.content ?? "").slice(0, MAX_CHUNK_CHARS).trim(),
        license_note:
          resource.license_note ||
          (resource.visibility === "global"
            ? "Uploaded to the shared library; licence not yet reviewed."
            : "Private upload, used only for this user."),
      }))
      .filter((c) => c.content.length >= 40)
      .slice(0, MAX_CHUNKS);

    clean.forEach((c) => Object.assign(c, { char_len: c.content.length }));

    // Re-indexing replaces rather than accumulates. The dedupe index would reject exact repeats anyway,
    // but a re-index after an edit would otherwise leave the old text retrievable alongside the new.
    const { error: delErr } = await service.from("resource_chunks").delete().eq("resource_id", resourceId);
    if (delErr) console.warn("index-resource: clearing old chunks failed:", delErr.message);

    let inserted = 0;
    for (let i = 0; i < clean.length; i += INSERT_BATCH) {
      const batch = clean.slice(i, i + INSERT_BATCH);
      const { error } = await service.from("resource_chunks").insert(batch);
      if (error) {
        console.error("index-resource insert failed:", error.message);
        break;
      }
      inserted += batch.length;
    }

    // no_text_layer is the honest outcome for a scan, and the UI uses it to explain why the tutor can't
    // quote the book — far better than reporting success over an empty index.
    const text_status = inserted > 0 ? "indexed" : "no_text_layer";

    const { error: updErr } = await service
      .from("resources")
      .update({
        text_status,
        chunk_count: inserted,
        ...(pageCount ? { page_count: pageCount } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", resourceId);
    if (updErr) console.warn("index-resource: status update failed:", updErr.message);

    return new Response(JSON.stringify({ indexed: inserted, text_status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("index-resource failed:", e);
    return new Response(JSON.stringify({ error: "Indexing failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
