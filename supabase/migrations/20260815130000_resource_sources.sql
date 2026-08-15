-- Where a resource came from, and whether we are allowed to HOST it.
--
-- "Publicly available" is not a licence: copyright attaches on creation, so a lecturer's problem set
-- on an open URL is no more redistributable than a textbook. Linking to it is unrestricted; storing
-- a copy is the licensed act — and that distinction is invisible at the call site, which is exactly
-- why resolve-past-papers previously mirrored anything that happened to download successfully.
--
-- NonCommercial is the other trap. MIT OCW and most of LibreTexts are CC BY-NC-SA, which cannot be
-- hosted inside a product that sells subscriptions even when the page itself is free to the student.
--
-- So this registry is the authority, mirroring is denied by default, and an unrecognised domain is
-- treated as all-rights-reserved — which is also what it legally is.

create table if not exists public.resource_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  homepage text,
  -- Hostnames owned by this source. Matched exactly or on a dot boundary, so "notopenstax.org"
  -- cannot pass as "openstax.org".
  url_patterns text[] not null default '{}',
  license_code text not null,
  license_url text,
  -- The credit line shown wherever the resource appears. CC BY is only satisfied if this is
  -- actually displayed, so it is stored with the source rather than reconstructed later.
  attribution text not null,
  mirror_allowed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.resource_sources enable row level security;

-- Readable by any signed-in user: attribution has to be renderable in the UI.
drop policy if exists "resource sources readable" on public.resource_sources;
create policy "resource sources readable" on public.resource_sources
  for select to authenticated using (true);

insert into public.resource_sources (name, homepage, url_patterns, license_code, license_url, attribution, mirror_allowed, notes) values
 ('OpenStax','https://openstax.org',array['openstax.org','assets.openstax.org','cnx.org'],'CC-BY-4.0','https://creativecommons.org/licenses/by/4.0/','© Rice University, OpenStax. Licensed CC BY 4.0.',true,'Most titles CC BY 4.0 — a few differ, confirm per book before mirroring.'),
 ('OpenIntro','https://www.openintro.org',array['openintro.org'],'CC-BY-SA-4.0','https://creativecommons.org/licenses/by-sa/4.0/','OpenIntro. Licensed CC BY-SA 4.0.',true,'ShareAlike: our adaptations of this must also be CC BY-SA.'),
 ('Active Calculus','https://activecalculus.org',array['activecalculus.org'],'CC-BY-SA-4.0','https://creativecommons.org/licenses/by-sa/4.0/','Matt Boelkins, Active Calculus. Licensed CC BY-SA 4.0.',true,null),
 ('Hefferon Linear Algebra','https://hefferon.net/linearalgebra/',array['hefferon.net'],'CC-BY-SA-4.0','https://creativecommons.org/licenses/by-sa/4.0/','Jim Hefferon, Linear Algebra. Licensed CC BY-SA.',true,'Verify GFDL vs CC BY-SA per edition.'),
 ('NIST DLMF','https://dlmf.nist.gov',array['dlmf.nist.gov'],'PD-US-GOV','https://dlmf.nist.gov/about/notes','NIST Digital Library of Mathematical Functions.',false,'US Gov work but NIST asserts usage conditions — link only until confirmed.'),
 ('MIT OpenCourseWare','https://ocw.mit.edu',array['ocw.mit.edu'],'CC-BY-NC-SA-4.0','https://creativecommons.org/licenses/by-nc-sa/4.0/','MIT OpenCourseWare. Licensed CC BY-NC-SA 4.0.',false,'NonCommercial — cannot be hosted inside a paid product. Link only.'),
 ('LibreTexts','https://libretexts.org',array['libretexts.org'],'CC-BY-NC-SA-4.0','https://creativecommons.org/licenses/by-nc-sa/4.0/','LibreTexts. Licence varies per page.',false,'Mostly NC and mixed per page. Link only.'),
 ('Isaac Physics','https://isaacphysics.org',array['isaacphysics.org'],'ARR','https://isaacphysics.org/terms','Isaac Physics, University of Cambridge.',false,'Free to use, NOT licensed for redistribution.'),
 ('Exam board / university papers','',array[]::text[],'ARR',null,'Rights retained by the issuing body.',false,'Default for anything unrecognised. Link only, never mirror.')
on conflict (name) do nothing;
