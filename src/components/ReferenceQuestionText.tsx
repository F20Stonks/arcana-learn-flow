// Faithful rendering of an ingested reference-paper question (STEP, BMO, BPhO, …).
//
// Extracted verbatim from ReferenceQuestions.tsx (the ingestion pilot viewer) so the student-facing
// STEP question bank and the pilot viewer can never drift apart typographically — both import this.
// Behaviour is unchanged from the pilot; only the location moved.
import MathRenderer from "@/components/MathRenderer";
import "katex/dist/katex.min.css";

// The segmentation model writes single newlines between sub-parts ("(a) ...\n(b) ..."), which
// CommonMark treats as a soft break (collapses to a space) rather than a visual line break — every
// sub-part reads as one run-on paragraph. This both forces each part onto its own paragraph AND
// indents roman-numeral parts ("(i)", "(ii)"...) and lettered sub-parts ("(a)", "(b)"...) the way the
// original paper does, by wrapping them in markdown blockquotes (nesting one level deeper for letters)
// — reusing MathRenderer's existing safe blockquote handling rather than injecting raw HTML into
// AI-generated content. The blockquote's "quoted text" look (italic, muted, colored border) is
// neutralized below in QUESTION_TEXT_CLASSES, so only the indentation survives.
const ROMAN_PART = /^\([ivx]+\)/i;
const LETTER_PART = /^\([a-z]\)/;

export const withStructure = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (LETTER_PART.test(trimmed)) return `> > ${trimmed}`;
      if (ROMAN_PART.test(trimmed)) return `> ${trimmed}`;
      return trimmed;
    })
    .filter(Boolean)
    .join("\n\n");

// Scoped overrides for MathRenderer's output on reference-paper surfaces only (Tailwind arbitrary
// descendant selectors) — larger, more open typography for long multi-part exam questions, without
// touching MathRenderer.tsx itself, so chat/teaching surfaces elsewhere in the app are unaffected.
export const QUESTION_TEXT_CLASSES =
  "font-[Newsreader] [&_.math-renderer_p]:text-[16px] [&_.math-renderer_p]:leading-[1.85] [&_.math-renderer_p]:mb-4 " +
  "[&_.math-renderer_p:last-child]:mb-0 [&_.katex-display]:my-3 [&_.katex]:text-[1.05em] " +
  // Blockquotes are reused purely for (i)/(a)-style indentation (see withStructure above) — strip the
  // "quoted text" treatment (border, italic, muted color) so only the indentation is visible. Nested
  // blockquotes (lettered sub-parts) compound the padding automatically for a deeper second level.
  "[&_.math-renderer_blockquote]:border-0 [&_.math-renderer_blockquote]:not-italic " +
  "[&_.math-renderer_blockquote]:text-foreground [&_.math-renderer_blockquote]:pl-6 [&_.math-renderer_blockquote]:mb-0";

/** Same treatment, one step larger — for the full-page single-question reading view. */
export const QUESTION_TEXT_CLASSES_LARGE =
  QUESTION_TEXT_CLASSES.replace("[&_.math-renderer_p]:text-[16px]", "[&_.math-renderer_p]:text-[18px]") +
  " [&_.katex-display]:my-5";

export default function ReferenceQuestionText({
  content,
  size = "default",
  className = "",
}: {
  content: string;
  size?: "default" | "large";
  className?: string;
}) {
  const base = size === "large" ? QUESTION_TEXT_CLASSES_LARGE : QUESTION_TEXT_CLASSES;
  return (
    <div className={`${base} ${className}`}>
      <MathRenderer content={withStructure(content)} />
    </div>
  );
}
