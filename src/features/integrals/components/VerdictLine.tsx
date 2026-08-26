import { AlertCircle, Check, HelpCircle, X } from "lucide-react";
import { describeFactor } from "../answer";
import type { Verdict } from "../types";

/**
 * The single most useful thing a grader can say is *how* you're wrong. "Off by a factor of 2" is a
 * different lesson from "not equivalent", so they get different messages.
 */
export default function VerdictLine({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <div className="min-h-[24px]" />;

  if (verdict.status === "correct") {
    return (
      <p className="flex items-center gap-2 text-[14px] font-medium text-primary">
        <Check className="h-4 w-4" /> Correct.
      </p>
    );
  }
  if (verdict.status === "off-by-constant-factor") {
    return (
      <p className="flex items-center gap-2 text-[14px] text-amber-500">
        <AlertCircle className="h-4 w-4 shrink-0" />
        Right shape — but your answer is {describeFactor(verdict.factor)}× the correct one. Check the
        constant you pulled out.
      </p>
    );
  }
  if (verdict.status === "unparseable") {
    return (
      <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <HelpCircle className="h-4 w-4 shrink-0" />
        {verdict.reason}
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-[14px] text-destructive">
      <X className="h-4 w-4 shrink-0" />
      {verdict.reason ?? "Not equivalent — differentiate it back and see what you get."}
    </p>
  );
}
