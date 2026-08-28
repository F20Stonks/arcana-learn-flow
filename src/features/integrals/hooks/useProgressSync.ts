import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { emptyProgress, getProgress, replaceProgress, subscribe } from "../progress";
import { mergeProgress, pullProgress, pushProgress } from "../progressSync";

const PUSH_DEBOUNCE_MS = 4000;

/**
 * progress.ts keeps one global localStorage key regardless of who's signed in — fine when a device
 * has one player, wrong if it ever has two. This tags which account's progress is currently sitting
 * in that key, purely so a second account signing into the same browser gets its own server copy
 * (or a clean slate) merged against, instead of inheriting whatever the first account left behind.
 */
const OWNER_KEY = "arcana.integrals.progress.owner.v1";

function localOwner(): string | null {
  try {
    return globalThis.localStorage?.getItem(OWNER_KEY) ?? null;
  } catch {
    return null;
  }
}

function setLocalOwner(userId: string) {
  try {
    globalThis.localStorage?.setItem(OWNER_KEY, userId);
  } catch {
    // No storage — nothing to tag, and nothing this sync can do about it.
  }
}

/**
 * Keeps this browser's Integral Arena progress in step with the signed-in account's server copy.
 *
 * localStorage stays the source of truth for instant reads and writes — nothing here sits in front
 * of play, and every network call fails soft (see progressSync.ts). Mount this once, high enough in
 * the tree to outlive navigation between Integral Arena pages (AppRoutes, in App.tsx) — it does
 * nothing while signed out, and re-arms itself if the signed-in user changes.
 *
 * On becoming known, the user's id triggers exactly one reconciliation: pull whatever the server
 * already has, merge it with whatever this device already has (see mergeProgress for why it's a
 * merge and not a pick), write the result back locally, and push it up. After that, every local
 * write schedules a debounced push — a training session firing off a request per keystroke would be
 * both wasteful and pointless, since only the settled state after a burst of solves is worth saving.
 */
export function useProgressSync(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const reconciledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || reconciledFor.current === userId) return;
    reconciledFor.current = userId;
    let cancelled = false;
    void (async () => {
      const remote = await pullProgress(userId);
      if (cancelled) return;
      const owner = localOwner();
      const local = owner !== null && owner !== userId ? emptyProgress() : getProgress();
      const merged = remote ? mergeProgress(local, remote) : local;
      replaceProgress(merged);
      setLocalOwner(userId);
      void pushProgress(userId, merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void pushProgress(userId, getProgress()), PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [userId]);
}
