/**
 * A plain done/not-done checklist for a third-party resource — no scoring, no streaks, just
 * "have I been through this yet." State is per-browser localStorage; there's nothing here worth
 * a backend round-trip for a single-user tracker.
 */
import { useEffect, useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import type { ExternalResourceGroup } from "../types";

function loadChecked(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveChecked(storageKey: string, checked: Set<string>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...checked]));
  } catch {
    // best-effort only — a private window or disabled storage just means nothing persists
  }
}

export default function ExternalResourceChecklist({ group }: { group: ExternalResourceGroup }) {
  const storageKey = `quant-external-resource:${group.id}`;
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setChecked(loadChecked(storageKey));
  }, [storageKey]);

  const toggle = (itemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      saveChecked(storageKey, next);
      return next;
    });
  };

  const doneCount = group.items.filter((i) => checked.has(i.id)).length;

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-foreground">{group.title}</h3>
        <span className="readout shrink-0 text-[12px] text-muted-foreground">
          {doneCount}/{group.items.length}
        </span>
      </div>
      <a
        href={group.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        Source <ExternalLink className="h-3 w-3" />
      </a>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{group.sourceNote}</p>

      <ul className="mt-4 flex flex-col gap-1.5">
        {group.items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <li key={item.id} className="flex items-center gap-2.5">
              <button
                onClick={() => toggle(item.id)}
                aria-pressed={isChecked}
                aria-label={isChecked ? `Mark "${item.label}" not done` : `Mark "${item.label}" done`}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  isChecked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                {isChecked && <Check className="h-3.5 w-3.5" />}
              </button>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-[14px] hover:underline ${isChecked ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {item.label}
                </a>
              ) : (
                <span className={`text-[14px] ${isChecked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
