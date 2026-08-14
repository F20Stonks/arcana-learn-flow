interface QuickAction {
  label: string;
  send: string;
}

/**
 * One-click ways to redirect the lesson.
 *
 * These started life as a rail of icons down the right edge, which was correctly called out as
 * useless: floating beside the canvas, unlabelled, they read as decoration and nobody would reach
 * for them. Sitting directly above the composer — where the eye already is when deciding what to say
 * next — they are read as what they are: the sentences you were about to type.
 */
const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Explain it differently",
    send: "Explain that again from a completely different angle — a different concrete case, not a reworded version of the same one.",
  },
  {
    label: "Go deeper on the why",
    send: "Go one level deeper on why that's actually true — what forces it? Don't stop at the first 'because'.",
  },
  {
    label: "Give me a problem",
    send: "Give me a problem on this that isn't a re-skin of the worked example — I want to try it unaided.",
  },
  {
    label: "Break it down smaller",
    send: "That moved too fast for me. Break that last step into smaller pieces and build it up more slowly.",
  },
  {
    label: "Show me a picture",
    send: "Show me what this looks like — I want to see the mechanism, not just read it.",
  },
  {
    label: "Quiz me on this",
    send: "Quiz me on what we've covered so far and find the gaps I don't know I have.",
  },
];

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  /** Full list vs the two-chip teaser above the composer. */
  expanded: boolean;
  onCollapse: () => void;
}

export default function QuickActions({ onSend, disabled, expanded, onCollapse }: Props) {
  const shown = expanded ? QUICK_ACTIONS : QUICK_ACTIONS.slice(0, 2);

  return (
    <div className={`mb-2 flex flex-wrap gap-1.5 ${expanded ? "" : "justify-center"}`}>
      {shown.map((action, i) => (
        <button
          key={action.label}
          onClick={() => {
            onSend(action.send);
            onCollapse();
          }}
          disabled={disabled}
          className="group flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-[11.5px] text-muted-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {action.label}
          <span className="rounded bg-secondary/70 px-1 text-[9.5px] tabular-nums text-muted-foreground/70 transition-colors group-hover:text-foreground/70">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
