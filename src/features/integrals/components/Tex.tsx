import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { segments, toMathMode } from "../mathText";

interface Props {
  children: string;
  block?: boolean;
  className?: string;
}

function render(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: "ignore" });
  } catch {
    return null;
  }
}

/**
 * Renders one of this feature's mixed prose/LaTeX strings.
 *
 * Inline strings are rendered run by run — prose as ordinary text, formulas as KaTeX — because a
 * KaTeX node is a single unbreakable inline box: a whole sentence rendered as one node runs off
 * the edge of its container instead of wrapping. Block mode is only ever used for standalone
 * formulas, which want to stay on one line anyway.
 *
 * Content is authored in-repo; the only outside input that reaches here is a student's own answer,
 * converted to LaTeX by mathjs and escaped by KaTeX, in that student's own browser.
 */
export default function Tex({ children, block = false, className = "" }: Props) {
  const parts = useMemo(() => {
    if (block) {
      const html = render(toMathMode(children), true);
      return html === null ? null : [{ text: null, html }];
    }
    return segments(children).map((seg) =>
      seg.type === "text" || /^\s*$/.test(seg.value)
        ? { text: seg.value, html: null }
        : { text: seg.value, html: render(seg.value, false) },
    );
  }, [children, block]);

  if (parts === null) return <span className={className}>{children}</span>;

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.html === null ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: part.html }} />
        ),
      )}
    </span>
  );
}
