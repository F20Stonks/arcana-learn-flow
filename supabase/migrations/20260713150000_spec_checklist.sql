-- Interactive specification checklist: real spec line items per track, each mapped to the subtopic(s)
-- that cover it, ticked off automatically as the student progresses. Resolved on demand per topic (not
-- once for the whole track) so coverage is real instead of one truncated excerpt.

CREATE TABLE public.spec_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  code TEXT, -- the spec's own numbering if it has one, e.g. "1.1" (nullable — not every spec numbers items)
  text TEXT NOT NULL, -- the item, quoted/closely paraphrased from the real spec
  rigor TEXT NOT NULL DEFAULT 'simple' CHECK (rigor IN ('simple', 'complex')),
  evidence_requirements JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["derivation shown", "conservation of momentum method used", ...] — only meaningful when rigor='complex'
  subtopic_ids UUID[] NOT NULL DEFAULT '{}', -- which of this track's subtopics cover this item (many-to-many in practice)
  source_url TEXT,
  ticked BOOLEAN NOT NULL DEFAULT false,
  ticked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spec_checklist_items ENABLE ROW LEVEL SECURITY;

-- Owned indirectly through the track (same join-through-parent pattern as topics/subtopics RLS).
CREATE POLICY "Users can view own spec checklist items" ON public.spec_checklist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.learning_tracks lt WHERE lt.id = spec_checklist_items.track_id AND lt.user_id = auth.uid())
);
-- Writes are service-role only (resolution + auto-ticking both happen server-side in edge functions,
-- same as concepts/past_papers) — no direct client insert/update path.
REVOKE ALL ON public.spec_checklist_items FROM anon;
GRANT SELECT ON public.spec_checklist_items TO authenticated;

CREATE INDEX idx_spec_checklist_items_track ON public.spec_checklist_items(track_id);
CREATE INDEX idx_spec_checklist_items_topic ON public.spec_checklist_items(topic_id);
