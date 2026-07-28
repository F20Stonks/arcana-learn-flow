// Shared with MathRenderer's remark-math convention: $$...$$ is display math, $...$ is inline.
// This is the ONLY place that convention is parsed for editing purposes — RichMathField uses it
// to turn stored "$...$"-delimited strings into editable chip nodes, and back again on save.
export type MathSpan =
  | { type: "text"; content: string }
  | { type: "math"; latex: string; display: boolean };

const SPAN_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function parseMathSpans(value: string): MathSpan[] {
  const spans: MathSpan[] = [];
  let lastIndex = 0;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(value))) {
    if (m.index > lastIndex) spans.push({ type: "text", content: value.slice(lastIndex, m.index) });
    if (m[1] !== undefined) spans.push({ type: "math", latex: m[1], display: true });
    else spans.push({ type: "math", latex: m[2], display: false });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < value.length) spans.push({ type: "text", content: value.slice(lastIndex) });
  return spans;
}
