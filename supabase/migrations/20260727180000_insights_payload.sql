-- The Notebook can now save a visualization straight from a session's end-of-session summary
-- (not just manually from the Math Theater), and Notes needs to faithfully re-render a saved
-- scene later. The existing formulas/params/mode columns were only ever a lightweight summary
-- for the Insights Library list row — not enough to reconstruct an arbitrary SceneSpec
-- (primitives, sliders, camera, etc.). Store the full payload as shown so the same Scene3D
-- renderer can play it back exactly. Nullable: existing rows and the archetype/SimulationPayload
-- path degrade gracefully to a title-only card wherever this is null.
ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS payload JSONB;
