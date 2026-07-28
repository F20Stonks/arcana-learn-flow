import { useRef, useState } from "react";
import { checkMatrixAnswer } from "@/lib/answerCheck";

interface Props {
  rows: number;
  cols: number;
  expectedAnswer: string;
  disabled: boolean;
  onSend: (text: string) => void;
  onEscape: () => void;
}

/**
 * Fill-in grid for matrix/vector answers (rows x cols, 1-4 each — cols=1 is a vector). Serializes
 * to the same pmatrix LaTeX MathSymbolPalette already inserts, wrapped in $...$, so the resulting
 * message renders through the existing KaTeX pipeline with no new parsing on the receiving end.
 * Checked instantly client-side against the tutor-embedded answer (see answerCheck.ts).
 */
export default function MatrixInput({ rows, cols, expectedAnswer, disabled, onSend, onEscape }: Props) {
  const [cells, setCells] = useState<string[]>(() => Array(rows * cols).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setCell = (idx: number, value: string) => {
    setCells((prev) => prev.map((c, i) => (i === idx ? value : c)));
  };

  const allFilled = cells.every((c) => c.trim().length > 0);

  const submit = () => {
    if (!allFilled) return;
    const rowStrings: string[] = [];
    for (let r = 0; r < rows; r++) rowStrings.push(cells.slice(r * cols, r * cols + cols).join(" & "));
    const latex = `$\\begin{pmatrix} ${rowStrings.join(" \\\\ ")} \\end{pmatrix}$`;
    const verdict = checkMatrixAnswer(cells, expectedAnswer);
    onSend(`${latex} (checked: ${verdict.correct ? "correct" : "incorrect"})`);
  };

  return (
    <div className="p-4 border-t border-border space-y-3">
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cells.map((val, idx) => (
          <input
            key={idx}
            ref={(el) => (inputRefs.current[idx] = el)}
            value={val}
            onChange={(e) => setCell(idx, e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const next = idx + 1;
              if (next < cells.length) inputRefs.current[next]?.focus();
              else submit();
            }}
            disabled={disabled}
            autoFocus={idx === 0}
            className="w-14 h-10 text-center rounded-lg bg-card border border-border text-sm text-foreground outline-hidden focus:border-primary/50 disabled:opacity-40"
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={disabled || !allFilled}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          Submit
        </button>
        <button onClick={onEscape} className="text-xs text-muted-foreground hover:text-foreground">
          Type instead →
        </button>
      </div>
    </div>
  );
}
