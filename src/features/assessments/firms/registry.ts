/**
 * The firm catalog.
 *
 * Explicit imports rather than a glob, matching DRILL_REGISTRY in src/features/drills/registry.ts:
 * a firm that is not listed here does not exist, which is easier to reason about than a directory
 * scan and keeps the bundle honest.
 *
 * Listed in the order they appear on the hub: the speed batteries first, since those are the
 * screens most candidates meet first and the ones this feature replicates most exactly, then the
 * longer probability screens.
 */
import type { FirmSpec, ModuleSpec } from "../types";
import { optiver } from "./optiver";
import { janeStreet } from "./janeStreet";
import { flowTraders } from "./flowTraders";
import { akuna } from "./akuna";
import { allOptions } from "./allOptions";
import { imc } from "./imc";
import { citadel } from "./citadel";
import { drw } from "./drw";
import { sig } from "./sig";
import { gResearch } from "./gResearch";

export const FIRM_REGISTRY: Record<string, FirmSpec> = {
  [optiver.id]: optiver,
  [janeStreet.id]: janeStreet,
  [flowTraders.id]: flowTraders,
  [akuna.id]: akuna,
  [allOptions.id]: allOptions,
  [imc.id]: imc,
  [citadel.id]: citadel,
  [drw.id]: drw,
  [sig.id]: sig,
  [gResearch.id]: gResearch,
};

export const FIRM_LIST = Object.values(FIRM_REGISTRY);

export function findFirm(firmId: string | undefined): FirmSpec | undefined {
  return firmId ? FIRM_REGISTRY[firmId] : undefined;
}

export function findModule(firmId: string | undefined, moduleId: string | undefined): ModuleSpec | undefined {
  const firm = findFirm(firmId);
  return firm && moduleId ? firm.modules.find((m) => m.id === moduleId) : undefined;
}

/** Total wall-clock minutes for a firm's full battery, for the catalog card. */
export function batteryMinutes(firm: FirmSpec): number {
  return Math.round(firm.modules.reduce((total, m) => total + (m.durationS ?? (m.perItemMs ?? 0) * m.itemCount / 1000), 0) / 60);
}
