import { supabase } from "@/integrations/supabase/client";

export type SyllabusTopic = { title: string; subtopics: string[] };

// topics.option_group / topics.archived_at (20260809130100_topic_archive_and_options.sql) and
// syllabus_trees.option (20260809130000_syllabus_tree_options.sql) are new columns the generated
// Supabase types don't know about yet — same situation TrackPapers.tsx already handles for
// generated_papers/past_papers (see its top-of-file comment). `as never as any` is the established
// escape hatch in this codebase for a column that exists in a written-but-not-yet-Lovable-run
// migration; swap these casts for real generated types once that migration has landed and `npx
// supabase gen types` (or Lovable's equivalent) has been re-run.
const topicsTable = () => supabase.from("topics" as never) as any;

/**
 * Write a batch of topics + their subtopics for a track. Batched deliberately: topics insert once,
 * then every subtopic across every topic inserts once, regardless of how many topics there are — for
 * a JEE-scale track (40+ topics, 350+ subtopics) that's two round trips instead of hundreds, while the
 * student sits on a spinner. Extracted from OnboardingPage.tsx so TrackOverview.tsx's option
 * add/restore flow can reuse the exact same insertion logic instead of re-deriving it.
 *
 * `optionGroup`: null tags every inserted topic as compulsory core (the onboarding case); a name tags
 * every inserted topic as belonging to that elective option — this is what lets a whole option's
 * topics later be archived/restored as one unit via a single UPDATE on option_group.
 */
export async function instantiateTopics(
  trackId: string,
  topics: SyllabusTopic[],
  optionGroup: string | null = null,
): Promise<void> {
  const { data: insertedTopics, error: topicErr } = await topicsTable()
    .insert(topics.map((t, i) => ({
      track_id: trackId,
      title: t.title,
      order_index: i,
      status: "unlocked",
      option_group: optionGroup,
    })))
    .select("id, order_index");

  if (topicErr || !insertedTopics) {
    console.error("topic insert failed:", topicErr);
    return;
  }

  // Match returned rows back by order_index rather than array position — insert() does not
  // guarantee the returned rows come back in the order they were sent.
  const idByOrder = new Map<number, string>();
  for (const row of insertedTopics as { id: string; order_index: number }[]) {
    idByOrder.set(row.order_index, row.id);
  }

  const subtopicRows = topics.flatMap((t, ti) => {
    const topicId = idByOrder.get(ti);
    if (!topicId) return [];
    return t.subtopics.map((title, si) => ({
      topic_id: topicId,
      title,
      order_index: si,
      status: "unlocked",
      estimated_minutes: 30,
    }));
  });

  if (subtopicRows.length) {
    const { error: subErr } = await supabase.from("subtopics").insert(subtopicRows);
    if (subErr) console.error("subtopic insert failed:", subErr);
  }
}

type OptionCapableTrack = {
  id: string;
  subject: string;
  level: string | null;
  exam_board: string | null;
};

/**
 * Add ONE elective option to an existing track — fetches the cached module (or authors it on a cache
 * miss) via author-syllabus-tree's option mode, then instantiates its topics tagged with this option's
 * name. If the option was already instantiated on this track before (active OR archived), restores it
 * instead of inserting a duplicate copy — archiving is meant to be fully reversible with zero re-fetch
 * or re-authoring cost, per the product decision that removing an option is never destructive
 * ("archive it, and you can add it back anytime, we don't need to be strict").
 */
export async function addOptionToTrack(
  track: OptionCapableTrack,
  option: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: existing } = await topicsTable()
    .select("id")
    .eq("track_id", track.id)
    .eq("option_group", option)
    .limit(1);
  if (existing && existing.length > 0) {
    return restoreOption(track.id, option);
  }

  try {
    const { data, error } = await supabase.functions.invoke("author-syllabus-tree", {
      body: {
        subject: track.subject,
        level: track.level,
        board: track.exam_board,
        option,
        goal: `${track.subject}${track.level ? ` ${track.level}` : ""}${track.exam_board ? ` (${track.exam_board})` : ""} — ${option} option`,
      },
    });
    if (error || !data?.ok) {
      console.error("option authoring failed:", error || data?.errors);
      return { ok: false, error: "Couldn't build that option right now — try again shortly." };
    }
    const topics = Array.isArray(data.tree?.topics) ? (data.tree.topics as SyllabusTopic[]) : [];
    if (topics.length === 0) return { ok: false, error: "No content came back for that option." };

    await instantiateTopics(track.id, topics, option);
    return { ok: true };
  } catch (e) {
    console.error("addOptionToTrack failed:", e);
    return { ok: false, error: "Couldn't build that option right now — try again shortly." };
  }
}

/**
 * Soft-remove an option's topics. NULL archived_at = active, a timestamp = archived — the exact
 * learning_tracks.archived_at pattern (20260713120000_track_archive.sql), reused here. Subtopics,
 * sessions, and notes underneath are never touched, so this is instant and fully reversible.
 */
export async function archiveOption(trackId: string, option: string): Promise<{ ok: boolean }> {
  const { error } = await topicsTable()
    .update({ archived_at: new Date().toISOString() })
    .eq("track_id", trackId)
    .eq("option_group", option)
    .is("archived_at", null);
  return { ok: !error };
}

/** Un-archive an option's topics. No re-fetch needed — the data was never deleted. */
export async function restoreOption(trackId: string, option: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await topicsTable()
    .update({ archived_at: null })
    .eq("track_id", trackId)
    .eq("option_group", option);
  if (error) console.error("restoreOption failed:", error);
  return { ok: !error };
}
