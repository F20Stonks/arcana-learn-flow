import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * How many spaced-review sessions are due right now.
 *
 * The Hub panel loads the full review rows because it renders them; the app shell only needs a
 * number for the "Reviews" badge, and it needs it on every page. Keeping this as its own tiny
 * query means the badge doesn't depend on the Hub panel having been opened — the whole point is
 * that a due review is visible without the student going looking for it.
 */
export function useDueReviewCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subtopic_reviews")
        .select("next_review_due_at")
        .eq("user_id", user.id)
        .lte("next_review_due_at", new Date().toISOString());
      if (!cancelled) setCount(data?.length ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return count;
}
