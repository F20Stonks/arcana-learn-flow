import type { DrillDefinition } from "./types";
import { zetamac } from "./games/zetamac";
import { modularRush } from "./games/modularRush";
import { factorSprint } from "./games/factorSprint";
import { sieveRace } from "./games/sieveRace";
import { vennBlitz } from "./games/vennBlitz";
import { cayleyFill } from "./games/cayleyFill";

export const DRILL_REGISTRY: Record<string, DrillDefinition> = {
  zetamac,
  "modular-rush": modularRush,
  "factor-sprint": factorSprint,
  "sieve-race": sieveRace,
  "venn-blitz": vennBlitz,
  "cayley-fill": cayleyFill,
};

export const DRILL_LIST = Object.values(DRILL_REGISTRY);
