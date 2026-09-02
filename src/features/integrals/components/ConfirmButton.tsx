import { useEffect, useRef, useState } from "react";

interface Props {
  /** The resting label — what the button offers to do. */
  children: React.ReactNode;
  /** The label once it is asking. Short: it sits where the resting label was. */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * A button for the two actions in this game you cannot take back: ending the daily's single scored
 * attempt, and stopping a sprint's clock. Both used to fire on one stray click.
 *
 * Two clicks rather than a modal — a dialog would steal focus and, in the sprint's case, cost the
 * seconds it is asking about. The armed state reverts on its own so nobody is left staring at a
 * question they didn't mean to ask.
 */
export default function ConfirmButton({ children, confirmLabel, onConfirm, className = "", icon }: Props) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const arm = () => {
    setArmed(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(false), 5000);
  };

  if (!armed) {
    return (
      <button
        type="button"
        onClick={arm}
        className={`flex items-center gap-1.5 py-1 text-[13px] text-muted-foreground/70 transition-colors hover:text-foreground ${className}`}
      >
        {icon}
        {children}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-muted-foreground">{confirmLabel}</span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          window.clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
        }}
        className="rounded-lg border border-destructive/40 px-2.5 py-1 font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => {
          window.clearTimeout(timer.current);
          setArmed(false);
        }}
        className="rounded-lg border border-border px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        Keep going
      </button>
    </span>
  );
}
