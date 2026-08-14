/**
 * Grouping of a flat message list into teaching turns.
 *
 * Lives outside the canvas because a "turn" is now the unit three different views agree on — the
 * free canvas places them, the deck pages through them one at a time, the chat lists them. If they
 * each grouped the transcript their own way, the same lesson would have a different number of
 * things in it depending on which view you were looking at.
 */

export interface CanvasMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Turn {
  /** Stable identity: the index of the message that opened the turn. */
  key: number;
  userIndex: number | null;
  assistantIndex: number | null;
}

export function groupIntoTurns(messages: CanvasMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      turns.push({ key: i, userIndex: i, assistantIndex: null });
    } else {
      const open = turns[turns.length - 1];
      if (open && open.assistantIndex === null) open.assistantIndex = i;
      else turns.push({ key: i, userIndex: null, assistantIndex: i });
    }
  }
  return turns;
}
