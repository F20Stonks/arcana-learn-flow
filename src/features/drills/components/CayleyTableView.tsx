import type { CayleyVisual } from "../types";

export default function CayleyTableView({ visual }: { visual: CayleyVisual }) {
  const n = visual.elements.length;
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-collapse font-mono text-sm tabular-nums">
        <thead>
          <tr>
            <th className="h-9 w-9 border border-border bg-secondary/40 text-muted-foreground">{visual.opLabel}</th>
            {visual.elements.map((e) => (
              <th key={e} className="h-9 w-9 border border-border bg-secondary/40 text-foreground">{e}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visual.elements.map((rowEl, r) => (
            <tr key={rowEl}>
              <th className="h-9 w-9 border border-border bg-secondary/40 text-foreground">{rowEl}</th>
              {visual.elements.map((_, c) => {
                const val = visual.cells[r * n + c];
                const isBlank = val === null;
                return (
                  <td
                    key={c}
                    className={`h-9 w-9 border border-border text-center ${
                      isBlank ? "bg-primary/15 text-primary font-bold" : "text-foreground"
                    }`}
                  >
                    {isBlank ? "?" : val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
