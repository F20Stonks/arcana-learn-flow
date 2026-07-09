import { Sparkles } from "lucide-react";
import { getBridgeCards } from "@/lib/bridgeCards";

interface Props {
  subject?: string | null;
  onPick?: (hint: string) => void;
}

export default function BridgeCards({ subject, onPick }: Props) {
  const cards = getBridgeCards(subject);
  return (
    <div className="border-t border-border p-3 space-y-2 bg-card/40">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Isomorphic Bridges
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={() => onPick?.(`Explore the link: ${c.title}. ${c.hook}`)}
            className="text-left rounded-lg border border-border/70 bg-background/60 hover:border-primary/50 hover:bg-accent/40 px-3 py-2 transition-colors"
          >
            <div className="text-xs font-medium text-foreground">{c.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug">{c.hook}</div>
          </button>
        ))}
      </div>
    </div>
  );
}