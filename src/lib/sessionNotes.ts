/**
 * Concise notes derived from the tutor's own turns, as the session runs.
 *
 * Deliberately NOT an extra AI call. The end-of-session assessment already authors real notes, and
 * spending a model round-trip per turn to restate what is already on screen is the kind of cost that
 * buys nothing a student can feel. What this does instead is exploit structure the tutor already
 * emits under its own prompt rules: **bold** for key terms, $$…$$ for the results worth keeping, and
 * an explanation that leads with the mechanism (rule 8, WHY-FIRST) — so the first declarative
 * sentence of a turn is reliably the claim, not preamble.
 *
 * The result is a running summary that is honest about being a summary. It is not a replacement for
 * the authored notes; it is what lets the student watch the lesson accumulate while it happens.
 */

export interface DerivedNote {
  messageIndex: number;
  /** One line: the claim this turn established. */
  headline: string;
  /** Display-math results worth keeping, in source form for KaTeX. */
  formulas: string[];
  /** Key terms the tutor bolded. */
  terms: string[];
}

const MAX_HEADLINE = 150;

/**
 * Split prose into sentences without ever cutting inside maths.
 *
 * Scanned character by character rather than split by regex: a full stop inside "$x = 1.5$" is not
 * a sentence end, and the obvious alternative — masking maths out and splicing it back — silently
 * mangles ordinary prose that happens to contain a bare number.
 */
function sentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inInline = false;
  let inDisplay = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "$") {
      if (text[i + 1] === "$") {
        inDisplay = !inDisplay;
        buf += "$$";
        i++;
        continue;
      }
      if (!inDisplay) inInline = !inInline;
    }
    buf += ch;
    const next = text[i + 1] ?? " ";
    const isStop = ch === "." || ch === "!" || ch === "?";
    if (!inInline && !inDisplay && isStop && /\s/.test(next)) {
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

function stripMarkup(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveNote(raw: string, messageIndex: number): DerivedNote | null {
  const formulas = [...raw.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1].trim()).filter(Boolean);
  const terms = [...new Set([...raw.matchAll(/\*\*(.+?)\*\*/g)].map((m) => stripMarkup(m[1])))]
    .filter((t) => t.length > 1 && t.length < 40)
    .slice(0, 4);

  // The claim, not the question that closes the turn — every turn ends with a challenge under the
  // tutor's prompt rules, and a question is never the thing worth writing down.
  const withoutDisplay = raw.replace(/\$\$[\s\S]*?\$\$/g, " ");
  const candidates = sentences(withoutDisplay)
    .map(stripMarkup)
    .filter((s) => s.length > 24 && !s.endsWith("?"));

  const headline = candidates[0] ?? "";
  if (!headline && formulas.length === 0 && terms.length === 0) return null;

  return {
    messageIndex,
    headline: headline.length > MAX_HEADLINE ? `${headline.slice(0, MAX_HEADLINE).trimEnd()}…` : headline,
    formulas: formulas.slice(0, 2),
    terms,
  };
}

export function deriveNotes(
  messages: { role: string; content: string }[],
  clean: (s: string) => string,
): DerivedNote[] {
  const out: DerivedNote[] = [];
  messages.forEach((m, i) => {
    if (m.role !== "assistant") return;
    const note = deriveNote(clean(m.content), i);
    if (note) out.push(note);
  });
  return out;
}
