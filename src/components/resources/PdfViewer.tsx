import { useEffect, useRef, useState, useCallback } from "react";
import { TextLayer } from "pdfjs-dist";
import { loadPdf, extractPageText, type PDFDocumentProxy } from "@/lib/pdf";
import { Skeleton } from "@/components/ui/skeleton";
import "./pdf-text-layer.css";

/** Never rasterise below 2x the presented size, whatever the display reports. */
const MIN_RENDER_SCALE = 2;
/** ~24 MP. Comfortably inside browser canvas limits, including mobile Safari's tighter ceiling. */
const MAX_CANVAS_PIXELS = 24_000_000;

interface PdfViewerProps {
  url: string;
  page: number;
  zoom: number;
  onDocumentLoad?: (numPages: number) => void;
  onPageText?: (page: number, text: string) => void;
  onSelectionChange?: (text: string) => void;
  onError?: (message: string) => void;
}

/**
 * Single-page PDF renderer: canvas for the image, an invisible text layer on top for selection.
 *
 * WHY ONE PAGE AND NOT A SCROLLING DOCUMENT: continuous scroll means keeping many canvases alive, which
 * on a 600-page book is the difference between a viewer and a memory leak. Paging also gives the AI panel
 * an unambiguous answer to "what is the student looking at" — with continuous scroll, "the current page"
 * is a guess about scroll position.
 */
export default function PdfViewer({
  url,
  page,
  zoom,
  onDocumentLoad,
  onPageText,
  onSelectionChange,
  onError,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  // Identifies the latest requested render. Anything that finishes with a stale token discards its work
  // instead of painting over a newer page — page-flicking outruns rendering easily on a dense page.
  const renderToken = useRef(0);
  const [loading, setLoading] = useState(true);
  // The document arrives asynchronously into a ref, and a ref assignment triggers nothing. Without this
  // counter the render effect would have already run (with no document) and would never re-run, leaving
  // a permanent skeleton on first load.
  const [docVersion, setDocVersion] = useState(0);

  // Callbacks live in a ref so the render effect doesn't re-run (and re-render the page) every time a
  // parent re-creates an inline arrow function. This is the same memoisation trap that caused the
  // step-player to reset itself once a second.
  const callbacks = useRef({ onDocumentLoad, onPageText, onSelectionChange, onError });
  useEffect(() => {
    callbacks.current = { onDocumentLoad, onPageText, onSelectionChange, onError };
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadPdf(url)
      .then((pdf) => {
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        callbacks.current.onDocumentLoad?.(pdf.numPages);
        setDocVersion((v) => v + 1);
      })
      .catch((e) => {
        if (!cancelled) callbacks.current.onError?.(e?.message || "Couldn't open this PDF.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const pdf = pdfRef.current;
    if (!pdf) return;

    const token = ++renderToken.current;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let textLayer: TextLayer | null = null;

    (async () => {
      try {
        const pageNumber = Math.min(Math.max(page, 1), pdf.numPages);
        const pdfPage = await pdf.getPage(pageNumber);
        if (token !== renderToken.current) return;

        const viewport = pdfPage.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const textDiv = textLayerRef.current;
        if (!canvas || !textDiv) return;

        // Rasterisation resolution, which is NOT the same as the presented size.
        //
        // devicePixelRatio alone is not enough. On a typical 1.25 dpr laptop at 110% zoom, an A4 page
        // rasterises to ~818px across — about 99 DPI, where a native PDF viewer targets 150-220. That is
        // exactly the "why does my PDF look worse here than everywhere else" difference, and it hurts
        // most on dense mathematical typesetting, where thin strokes and subscripts are the first things
        // to mush. So take a floor of 2x the presented size regardless of the display.
        const dpr = window.devicePixelRatio || 1;
        let outputScale = Math.max(dpr, MIN_RENDER_SCALE);

        // ...but bound the allocation. A large page at 250% zoom would otherwise ask for a canvas of
        // tens of megapixels, and browsers silently fail to allocate past their limit — which presents
        // as a BLANK page, a far worse outcome than a slightly soft one.
        const area = viewport.width * viewport.height;
        if (area * outputScale * outputScale > MAX_CANVAS_PIXELS) {
          outputScale = Math.sqrt(MAX_CANVAS_PIXELS / area);
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        renderTask = pdfPage.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        if (token !== renderToken.current) return;

        // The text layer must cover the canvas exactly: pdf.js positions spans as percentages of this
        // container, and sizes them against --total-scale-factor.
        textDiv.replaceChildren();
        textDiv.style.width = `${Math.floor(viewport.width)}px`;
        textDiv.style.height = `${Math.floor(viewport.height)}px`;
        textDiv.style.setProperty("--total-scale-factor", String(zoom));

        textLayer = new TextLayer({
          textContentSource: await pdfPage.getTextContent(),
          container: textDiv,
          viewport,
        });
        await textLayer.render();
        if (token !== renderToken.current) return;

        setLoading(false);

        // Hand the page's text up so the assistant can ground an answer in exactly what is on screen,
        // with no indexing round-trip.
        if (callbacks.current.onPageText) {
          const text = await extractPageText(pdf, pageNumber);
          if (token === renderToken.current) callbacks.current.onPageText(pageNumber, text);
        }
      } catch (e) {
        const err = e as { name?: string; message?: string };
        // A cancelled render is the expected outcome of turning the page quickly, not a failure.
        if (err?.name === "RenderingCancelledException") return;
        if (token === renderToken.current) {
          callbacks.current.onError?.(err?.message || "Couldn't render this page.");
          setLoading(false);
        }
      }
    })();

    return () => {
      renderTask?.cancel();
      textLayer?.cancel?.();
    };
  }, [page, zoom, docVersion]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    // Only report selections made INSIDE this viewer — a click elsewhere on the page shouldn't clear or
    // hijack what the assistant thinks the student highlighted.
    if (text && containerRef.current && selection?.anchorNode && containerRef.current.contains(selection.anchorNode)) {
      callbacks.current.onSelectionChange?.(text);
    }
  }, []);

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className="p-4">
      {/* w-max + mx-auto, NOT a flex row with justify-center. As a flex item this wrapper shrank to the
          available width while the canvas kept its true size and overflowed it — and because the text
          layer is inset:0 on this wrapper, its spans were then positioned as percentages of a box 30px
          narrower than the page at 160% zoom, so selections drifted further from the glyphs the further
          right you went. w-max makes the wrapper track the canvas; mx-auto still centres it when there
          is room, and simply overflows right (into the parent's scroll) when there isn't. */}
      <div className="relative mx-auto w-max shadow-lg rounded-sm overflow-hidden bg-white">
        {loading && <Skeleton className="absolute inset-0 z-10" />}
        <canvas ref={canvasRef} className="block" />
        <div ref={textLayerRef} className="pdf-text-layer" />
      </div>
    </div>
  );
}
