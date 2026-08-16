import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
// ?url gives Vite the built worker's final URL instead of inlining it into the main bundle. pdf.js
// insists on a real worker: without one it falls back to parsing on the main thread, which locks the tab
// solid on a 600-page book.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

export interface ExtractedChunk {
  page: number;
  content: string;
}

/** Roughly a healthy retrieval unit: big enough to carry an argument, small enough to stay on topic. */
const TARGET_CHUNK = 1200;
const MIN_CHUNK = 40;

export function loadPdf(src: string | ArrayBuffer): Promise<PDFDocumentProxy> {
  const task = typeof src === "string" ? getDocument(src) : getDocument({ data: src });
  return task.promise;
}

/**
 * Reassemble a page's text items into readable text.
 *
 * pdf.js emits positioned glyph runs, not sentences — concatenating them naively welds the end of one
 * line to the start of the next ("...continuousfunction..."), which wrecks both retrieval and anything
 * the model is asked to quote. `hasEOL` marks a line break in the source, so it is the honest place to
 * put a newline.
 */
export async function extractPageText(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  let text = "";
  for (const item of content.items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
    else if (item.str && !item.str.endsWith(" ")) text += " ";
  }
  // Collapse the blank-line storms that come from figure and equation positioning, but keep paragraph
  // breaks, which are the boundaries chunking relies on.
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Extract the whole document as retrieval chunks.
 *
 * Chunks never span pages. That costs a little continuity at page boundaries and buys the ability to cite
 * "page 214" on every retrieved passage — which is what makes a grounded answer checkable by the student
 * rather than something they have to take on trust.
 */
export async function extractChunks(
  pdf: PDFDocumentProxy,
  onProgress?: (page: number, total: number) => void,
): Promise<ExtractedChunk[]> {
  const chunks: ExtractedChunk[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const text = await extractPageText(pdf, p);
    onProgress?.(p, pdf.numPages);
    if (text.length < MIN_CHUNK) continue;

    for (const piece of splitToChunks(text)) {
      chunks.push({ page: p, content: piece });
    }
  }
  return chunks;
}

/** Split on paragraph boundaries, packing up to TARGET_CHUNK. Oversized paragraphs are split on sentences. */
function splitToChunks(text: string): string[] {
  const out: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed.length >= MIN_CHUNK) out.push(trimmed);
    current = "";
  };

  for (const paragraph of text.split(/\n\s*\n/)) {
    const p = paragraph.trim();
    if (!p) continue;

    if (p.length > TARGET_CHUNK) {
      flush();
      // Split after ". " but not after "e.g." or a decimal point — a lookbehind for a lowercase letter or
      // digit-free terminator is a decent approximation without a sentence tokeniser.
      for (const sentence of p.split(/(?<=[a-z0-9)\]])\.\s+(?=[A-Z$\\])/)) {
        if (current.length + sentence.length > TARGET_CHUNK) flush();
        current += (current ? " " : "") + sentence;
      }
      flush();
      continue;
    }

    if (current.length + p.length > TARGET_CHUNK) flush();
    current += (current ? "\n\n" : "") + p;
  }
  flush();
  return out;
}
