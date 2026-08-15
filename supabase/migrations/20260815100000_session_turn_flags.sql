-- Turn-level flags: the calibration channel between a human judgement and a specific moment.
--
-- Teaching quality can be swept at scale by a grader, but a grader cannot tell you that a turn was
-- technically correct and completely lifeless. That judgement is human, and it has to attach to the
-- EXACT turn that provoked it — a note written after the session ("it got confusing in the middle")
-- cannot be lined up against a transcript position, so it can never be used to correct a rubric.
--
-- These rows are the ground truth an automated grader gets calibrated against: where the grader and
-- the human disagree, the rubric is what changes.

create table if not exists public.session_turn_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  subtopic_id uuid,

  -- Position within the session transcript, so the flag can be replayed against it later.
  message_index int,
  role text,
  -- A copy of what was actually flagged. Deliberately denormalised: transcripts get edited, resumed
  -- and re-rendered, and a flag that can no longer show what it referred to is worthless.
  excerpt text,

  tags text[] not null default '{}',
  note text,

  created_at timestamptz not null default now()
);

create index if not exists session_turn_flags_session_idx on public.session_turn_flags (session_id);
create index if not exists session_turn_flags_created_idx on public.session_turn_flags (created_at desc);

alter table public.session_turn_flags enable row level security;

drop policy if exists "own turn flags insert" on public.session_turn_flags;
create policy "own turn flags insert" on public.session_turn_flags
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own turn flags select" on public.session_turn_flags;
create policy "own turn flags select" on public.session_turn_flags
  for select to authenticated using (auth.uid() = user_id);
