import { RotateCcw } from "lucide-react";
import {
  ACCENTS, FONT_LABELS,
  type Density, type FontChoice, type GridStrength, type RevealPace, type SessionPrefs,
} from "@/lib/sessionPrefs";

interface Props {
  prefs: SessionPrefs;
  onChange: (patch: Partial<SessionPrefs>) => void;
  onReset: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/50 px-3.5 py-3 first:border-t-0">
      <h4 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-background/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors duration-200 ${
            value === o.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Range({
  value, min, max, step, onChange, format,
}: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/70">
        {format(value)}
      </span>
    </div>
  );
}

/**
 * Everything about the workspace the student is allowed to change.
 *
 * Grouped by what it affects rather than by what it technically is, and every control takes effect
 * on the spot — no apply button, no preview pane. The one thing worth defending here is the reset:
 * a settings panel this open needs a guaranteed way back, or people stop touching it for fear of
 * ending up somewhere they can't undo.
 */
export default function SessionSettingsPanel({ prefs, onChange, onReset }: Props) {
  return (
    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
      <Section title="Typography">
        <Row label="Typeface">
          <Segmented<FontChoice>
            value={prefs.font}
            onChange={(font) => onChange({ font })}
            options={(["sans", "serif", "mono"] as FontChoice[]).map((id) => ({ id, label: FONT_LABELS[id] }))}
          />
        </Row>
        <Row label="Text size">
          <Range
            value={prefs.textScale} min={0.85} max={1.35} step={0.05}
            onChange={(textScale) => onChange({ textScale })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Row>
        <Row label="Line height">
          <Range
            value={prefs.lineHeight} min={1.4} max={2.2} step={0.05}
            onChange={(lineHeight) => onChange({ lineHeight })}
            format={(v) => v.toFixed(2)}
          />
        </Row>
        <Row label="Math size">
          <Range
            value={prefs.mathScale} min={0.85} max={1.4} step={0.05}
            onChange={(mathScale) => onChange({ mathScale })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Row>
      </Section>

      <Section title="Density">
        <Row label="Spacing">
          <Segmented<Density>
            value={prefs.density}
            onChange={(density) => onChange({ density })}
            options={[
              { id: "compact", label: "Compact" },
              { id: "normal", label: "Normal" },
              { id: "roomy", label: "Roomy" },
            ]}
          />
        </Row>
        <p className="text-[10px] leading-relaxed text-muted-foreground/60">
          Sets card padding, the gap between exchanges, and how wide a new card starts.
        </p>
      </Section>

      <Section title="Motion">
        <Row label="Reveal">
          <Segmented<RevealPace>
            value={prefs.reveal}
            onChange={(reveal) => onChange({ reveal })}
            options={[
              { id: "instant", label: "Off" },
              { id: "calm", label: "Calm" },
              { id: "steady", label: "Steady" },
              { id: "brisk", label: "Brisk" },
            ]}
          />
        </Row>
        <Row label="Animation">
          <Segmented<"on" | "off">
            value={prefs.animations ? "on" : "off"}
            onChange={(v) => onChange({ animations: v === "on" })}
            options={[{ id: "on", label: "On" }, { id: "off", label: "Off" }]}
          />
        </Row>
      </Section>

      <Section title="Canvas">
        <Row label="Dot grid">
          <Segmented<GridStrength>
            value={prefs.grid}
            onChange={(grid) => onChange({ grid })}
            options={[
              { id: "off", label: "Off" },
              { id: "faint", label: "Faint" },
              { id: "normal", label: "Normal" },
              { id: "strong", label: "Strong" },
            ]}
          />
        </Row>
        <Row label="Backdrop">
          <Range
            value={prefs.tone} min={-40} max={40} step={4}
            onChange={(tone) => onChange({ tone })}
            format={(v) => (v === 0 ? "—" : v < 0 ? `−${-v}` : `+${v}`)}
          />
        </Row>
        <Row label="Accent">
          <div className="flex items-center gap-1.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => onChange({ accent: a.id })}
                title={a.label}
                aria-label={`${a.label} accent`}
                className={`h-4 w-4 rounded-full border transition-transform duration-200 hover:scale-110 ${
                  prefs.accent === a.id ? "border-foreground/80 ring-2 ring-foreground/25" : "border-border/60"
                }`}
                style={{ background: a.swatch }}
              />
            ))}
          </div>
        </Row>
      </Section>

      <div className="border-t border-border/50 px-3.5 py-3">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reset to defaults
        </button>
      </div>
    </div>
  );
}
