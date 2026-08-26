-- 1. SECURITY DEFINER function callable by anon/authenticated (lints 0028/0029).
--    book_track_progress takes p_user_id and bypasses RLS; only server-side code should call it.
REVOKE EXECUTE ON FUNCTION public.book_track_progress(uuid, uuid) FROM anon, authenticated, PUBLIC;

-- 2. anon-visible object in the GraphQL/Data API (lint 0026).
REVOKE SELECT ON public.drill_weak_spots FROM anon;

-- 3. lesson_plans: cached teaching plans contain answers/mark-scheme content and are only read
--    server-side with the service role. Remove the any-authenticated read policy and grants.
DROP POLICY IF EXISTS "Authenticated users can view lesson plans" ON public.lesson_plans;
REVOKE SELECT ON public.lesson_plans FROM anon, authenticated;
GRANT ALL ON public.lesson_plans TO service_role;

-- 4. syllabus_trees: same, authored/read only by edge functions.
DROP POLICY IF EXISTS "Authenticated users can view syllabus trees" ON public.syllabus_trees;
REVOKE SELECT ON public.syllabus_trees FROM anon, authenticated;
GRANT ALL ON public.syllabus_trees TO service_role;

-- 5. subtopic_concepts: had SELECT/INSERT ownership policies but no UPDATE/DELETE, so rows could
--    never be curated and any write path was undefined. Add owner-scoped UPDATE/DELETE.
CREATE POLICY "Users can update own subtopic_concepts"
ON public.subtopic_concepts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM subtopics st
  JOIN topics t ON t.id = st.topic_id
  JOIN learning_tracks lt ON lt.id = t.track_id
  WHERE st.id = subtopic_concepts.subtopic_id AND lt.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM subtopics st
  JOIN topics t ON t.id = st.topic_id
  JOIN learning_tracks lt ON lt.id = t.track_id
  WHERE st.id = subtopic_concepts.subtopic_id AND lt.user_id = auth.uid()
));

CREATE POLICY "Users can delete own subtopic_concepts"
ON public.subtopic_concepts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM subtopics st
  JOIN topics t ON t.id = st.topic_id
  JOIN learning_tracks lt ON lt.id = t.track_id
  WHERE st.id = subtopic_concepts.subtopic_id AND lt.user_id = auth.uid()
));

-- 6. profiles privilege escalation: keep column-level protection but also block the Data API from
--    writing the privileged columns at all, so the trigger is defence-in-depth rather than the only gate.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url, updated_at) ON public.profiles TO authenticated;