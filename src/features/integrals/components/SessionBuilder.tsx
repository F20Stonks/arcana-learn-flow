/**
 * The practice session builder — the database page's answer to "set up my own sessions and work
 * through the bank", not just look a problem up.
 *
 * A session is a filter (technique(s), source(s), a difficulty range, optionally unsolved-only)
 * plus, once saved, a name and a stable id. Unsaved, it is a one-off: pick a filter, hit start,
 * work it, gone. Saved, it is a bookmark `IntegralTraining.tsx`'s custom mode resolves by id
 * (`?session=<id>`), which is what makes "resume where I left off" and a live "how much is left"
 * count possible — the same queue/place-tracking machinery every other practice mode already has,
 * just pointed at a filter instead of one technique.
 *
 * Deliberately its own component, not folded into `IntegralDatabase.tsx`'s existing single-select
 * search filters: those answer "find this one integral again", multi-select answers "give me
 * everything matching this shape" — different questions, so kept visually and statefully separate
 * rather than overloading one set of controls to do both badly.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ListPlus, Play, Save, Trash2, X } from "lucide-react";
import { useProgress } from "../hooks/useProgress";
import { usePracticeSessions } from "../hooks/usePracticeSessions";
import { hasSolved } from "../progress";
import { TECHNIQUES } from "../techniques";
import { DIFFICULTY_LABEL, formatSource, problemsForFilter, sourceKey, SOURCES } from "../problems";
import { deletePracticeSession, renamePracticeSession, savePracticeSession } from "../practiceSessions";
import type { ProblemFilter } from "../problems";
import type { Difficulty, TechniqueId } from "../types";

const ALL_DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5];

/** techniques= and sources= both carry a comma-joined list of URI-encoded tokens — encoded per
 *  entry (never the whole joined string) so a name that happened to contain a comma can't be
 *  mistaken for a second entry. */
function toParam(values: string[]): string {
  return values.map(encodeURIComponent).join(",");
}

function trainingUrl(filter: ProblemFilter, unsolvedOnly: boolean): string {
  const params = new URLSearchParams();
  if (filter.techniques?.length) params.set("techniques", toParam(filter.techniques));
  if (filter.sourceKeys?.length) params.set("sources", toParam(filter.sourceKeys));
  if (filter.minDifficulty) params.set("minDifficulty", String(filter.minDifficulty));
  if (filter.maxDifficulty) params.set("maxDifficulty", String(filter.maxDifficulty));
  if (unsolvedOnly) params.set("unsolved", "1");
  return `/integrals/train/custom?${params.toString()}`;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-[12.5px] transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** One saved session's row: live count, resume, rename in place, delete. */
function SavedSessionRow({ id, name, filter, unsolvedOnly }: { id: string; name: string; filter: ProblemFilter; unsolvedOnly: boolean }) {
  const progress = useProgress();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const matched = useMemo(() => problemsForFilter(filter), [filter]);
  const solved = matched.filter((p) => hasSolved(progress, p.id)).length;
  const remaining = unsolvedOnly ? matched.length - solved : matched.length;

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) renamePracticeSession(id, trimmed);
    else setDraft(name);
    setEditing(false);
  };

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-primary/40 bg-card px-1.5 py-0.5 text-[14px] text-foreground"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-[14px] font-medium text-foreground hover:underline"
            title="Rename"
          >
            {name}
          </button>
        )}
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {remaining} problem{remaining === 1 ? "" : "s"} left
          {unsolvedOnly ? "" : ` · ${solved}/${matched.length} solved`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={`/integrals/train/custom?session=${id}`}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Play className="h-3.5 w-3.5" /> Start
        </Link>
        <button
          type="button"
          onClick={() => deletePracticeSession(id)}
          aria-label={`Delete ${name}`}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export default function SessionBuilder() {
  const progress = useProgress();
  const sessions = usePracticeSessions();
  const [open, setOpen] = useState(false);
  const [techniques, setTechniques] = useState<Set<TechniqueId>>(new Set());
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [minDifficulty, setMinDifficulty] = useState<Difficulty>(1);
  const [maxDifficulty, setMaxDifficulty] = useState<Difficulty>(5);
  const [unsolvedOnly, setUnsolvedOnly] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const filter: ProblemFilter = useMemo(
    () => ({
      techniques: techniques.size ? [...techniques] : undefined,
      sourceKeys: sources.size ? [...sources] : undefined,
      minDifficulty,
      maxDifficulty,
    }),
    [techniques, sources, minDifficulty, maxDifficulty],
  );

  const matched = useMemo(() => problemsForFilter(filter), [filter]);
  const solvedCount = matched.filter((p) => hasSolved(progress, p.id)).length;
  const sessionSize = unsolvedOnly ? matched.length - solvedCount : matched.length;

  const clearAll = () => {
    setTechniques(new Set());
    setSources(new Set());
    setMinDifficulty(1);
    setMaxDifficulty(5);
    setUnsolvedOnly(false);
  };

  const hasAnyFilter =
    techniques.size > 0 || sources.size > 0 || minDifficulty !== 1 || maxDifficulty !== 5 || unsolvedOnly;

  return (
    <div className="reveal rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="session-builder-panel"
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 font-display text-[15px] font-semibold text-foreground">
          <ListPlus className="h-4 w-4 text-primary" /> Build a practice session
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="session-builder-panel" className="border-t border-border px-4 pb-4 pt-3.5">
          <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
            Any combination of technique, source and difficulty — union within a group, AND across
            groups. Leave a group empty to mean "every one." Start it once, or save it and come
            back until it's clear.
          </p>

          <div className="mb-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Techniques {techniques.size > 0 && `(${techniques.size})`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TECHNIQUES.map((t) => (
                <Chip key={t.id} active={techniques.has(t.id)} onClick={() => setTechniques((s) => toggle(s, t.id))}>
                  {t.name}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Sources {sources.size > 0 && `(${sources.size})`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => {
                const key = sourceKey(s);
                return (
                  <Chip key={key} active={sources.has(key)} onClick={() => setSources((set) => toggle(set, key))}>
                    {formatSource(s)}
                  </Chip>
                );
              })}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">Difficulty</span>
              <select
                value={minDifficulty}
                onChange={(e) => {
                  const v = Number(e.target.value) as Difficulty;
                  setMinDifficulty(v);
                  if (v > maxDifficulty) setMaxDifficulty(v);
                }}
                className="rounded-lg border border-border bg-background px-2 py-1 text-[13px] text-foreground"
              >
                {ALL_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">to</span>
              <select
                value={maxDifficulty}
                onChange={(e) => {
                  const v = Number(e.target.value) as Difficulty;
                  setMaxDifficulty(v);
                  if (v < minDifficulty) setMinDifficulty(v);
                }}
                className="rounded-lg border border-border bg-background px-2 py-1 text-[13px] text-foreground"
              >
                {ALL_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={unsolvedOnly}
                onChange={(e) => setUnsolvedOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Unsolved only
            </label>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear filter
              </button>
            )}
          </div>

          <p className="mb-3 text-[13px] text-muted-foreground">
            <span className="readout font-medium text-foreground">{sessionSize}</span> problem
            {sessionSize === 1 ? "" : "s"} in this session
            {!unsolvedOnly && matched.length > 0 && ` · ${solvedCount}/${matched.length} already solved`}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            {sessionSize > 0 ? (
              <Link
                to={trainingUrl(filter, unsolvedOnly)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Play className="h-3.5 w-3.5" /> Start practicing ({sessionSize})
              </Link>
            ) : (
              <span className="text-[13px] text-muted-foreground">
                Nothing matches this filter — widen it to start.
              </span>
            )}

            <input
              value={saveName}
              onChange={(e) => {
                setSaveName(e.target.value);
                setJustSaved(false);
              }}
              placeholder="Name it to save for later…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
            />
            <button
              type="button"
              disabled={!saveName.trim()}
              onClick={() => {
                savePracticeSession(saveName.trim(), filter, unsolvedOnly);
                setSaveName("");
                setJustSaved(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" /> {justSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
            My sessions
          </div>
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <SavedSessionRow key={s.id} id={s.id} name={s.name} filter={s.filter} unsolvedOnly={s.unsolvedOnly} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
