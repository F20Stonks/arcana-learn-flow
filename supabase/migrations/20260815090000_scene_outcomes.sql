-- Scene outcome logging — the production instrument behind the visualisation reliability target.
--
-- The <1/10,000 bar cannot be sampled into existence by the offline coverage harness: a 32-case
-- battery has nowhere near that resolution, and it exercises the Director in isolation rather than
-- the real teaching loop. The only way to actually measure the rate is to count what happens to
-- every scene a real student is shown. Nothing recorded that before this table: a scene that failed
-- to render was indistinguishable from a session where the tutor simply never asked for one.
--
-- One row per scene REQUEST (not per render), written client-side from sceneDirector's ladder.

create table if not exists public.scene_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  subtopic_id uuid,

  -- The tutor's <scene-request> body. Kept verbatim rather than hashed: identical requests are what
  -- a future verified-scene cache would key on, and the failure classes only become legible when you
  -- can read what was actually asked for.
  request text not null,

  -- Which rung of the ladder this exited on:
  --   clean          -- authored and validated first time, nothing touched
  --   repaired       -- mechanical repair alone made it valid (no model call, no cost)
  --   model-repaired -- needed one model repair call
  --   degraded       -- still not clean; showed the best surviving version rather than nothing
  --   failed         -- nothing renderable survived
  --   no-scene       -- the Director never returned a parsable scene at all
  outcome text not null check (outcome in ('clean','repaired','model-repaired','degraded','failed','no-scene')),
  rung int not null,

  -- 'freehand' today. Reserved for 'template' once the template library lands, because the whole
  -- premise of templates is that this column should show them failing far less often.
  source text not null default 'freehand',

  hard_fail boolean not null default false,
  flags text[] not null default '{}',
  issue_kinds text[] not null default '{}',
  repair_actions text[] not null default '{}',
  prim_count int,
  attempts int,

  created_at timestamptz not null default now()
);

create index if not exists scene_outcomes_created_idx on public.scene_outcomes (created_at desc);
create index if not exists scene_outcomes_outcome_idx on public.scene_outcomes (outcome);

alter table public.scene_outcomes enable row level security;

-- A student may only ever write and read their OWN scene outcomes. Aggregate analysis runs with the
-- service role, which bypasses RLS.
drop policy if exists "own scene outcomes insert" on public.scene_outcomes;
create policy "own scene outcomes insert" on public.scene_outcomes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own scene outcomes select" on public.scene_outcomes;
create policy "own scene outcomes select" on public.scene_outcomes
  for select to authenticated using (auth.uid() = user_id);
