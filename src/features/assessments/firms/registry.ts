/**
 * The firm catalog.
 *
 * Explicit imports rather than a glob, matching DRILL_REGISTRY in src/features/drills/registry.ts:
 * a firm that is not listed here does not exist, which is easier to reason about than a directory
 * scan and keeps the bundle honest.
 */
import type { FirmSpec, ModuleSpec } from "../types";
import { optiver } from "./optiver";

export const FIRM_REGISTRY: Record<string, FirmSpec> = {
  optiver,
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
