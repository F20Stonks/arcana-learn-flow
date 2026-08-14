import { useEffect, useRef, useState } from "react";

/**
 * Reveal streamed text at a steady, readable pace instead of in whatever lumps the network delivers.
 *
 * The transport already streams token-by-token, but the gateway flushes several sentences at a time,
 * so a turn lands as two or three sudden dumps. That reads as a machine pasting output; a steady
 * reveal reads as something composing an explanation, and — more usefully — it lets the eye start at
 * the top of a paragraph rather than being handed the whole block at once.
 *
 * The rate scales with how far behind we are, so a long backlog catches up instead of falling
 * minutes behind, and the reveal always lands exactly on the final text.
 */

/**
 * Clamp a cut point back to somewhere it is safe to stop rendering.
 *
 * Cutting mid-`$…$` hands KaTeX an unterminated expression and cutting mid-`**` leaves markdown
 * showing literal asterisks — both flash visible garbage on every frame. Rather than reveal those
 * partial states, hold at the last boundary where the markup is balanced.
 */
function safeCut(text: string, n: number): number {
  const head = text.slice(0, n);

  // Unbalanced display math wins over inline: "$$" is two "$" and would otherwise look balanced.
  const displayCount = (head.match(/\$\$/g) || []).length;
  if (displayCount % 2 === 1) return head.lastIndexOf("$$");

  const withoutDisplay = head.replace(/\$\$[\s\S]*?\$\$/g, "");
  if ((withoutDisplay.match(/\$/g) || []).length % 2 === 1) return head.lastIndexOf("$");

  if ((head.match(/\*\*/g) || []).length % 2 === 1) return head.lastIndexOf("**");

  // Never strand a lone backslash — the start of a LaTeX command whose name hasn't arrived.
  const trailingCommand = head.match(/\\[a-zA-Z]*$/);
  if (trailingCommand) return n - trailingCommand[0].length;

  return n;
}

/**
 * @param rate Multiplier on the reveal speed, from the student's session preferences. 0 turns the
 *   animation off entirely — text simply appears as it arrives, which is what someone who finds
 *   paced reveals patronising (or who uses a screen reader) actually wants.
 */
export function useSmoothReveal(full: string, active: boolean, rate = 1): string {
  const animate = active && rate > 0;
  const [count, setCount] = useState(full.length);
  const countRef = useRef(count);
  countRef.current = count;
  const frame = useRef<number>();

  useEffect(() => {
    // Not streaming: show everything immediately. Also covers resumed transcripts, where every
    // message is already complete and animating them would be theatre.
    if (!animate) {
      setCount(full.length);
      return;
    }

    // A shorter target means a new turn started — restart rather than run backwards.
    if (countRef.current > full.length) setCount(0);

    const tick = () => {
      const target = full.length;
      const current = countRef.current;
      if (current >= target) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      const backlog = target - current;
      // ~3 chars/frame at rest (≈180/s, close to fast reading), accelerating when behind so a big
      // flush is absorbed in a moment rather than queued for a minute.
      const step = Math.max(Math.ceil(3 * rate), Math.ceil(backlog / 10));
      setCount(Math.min(target, current + step));
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [full, animate, rate]);

  if (!animate) return full;
  if (count >= full.length) return full;
  const cut = safeCut(full, count);
  return full.slice(0, Math.max(0, cut));
}
