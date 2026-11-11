-- Dossiers thématiques classés par Jev (TypeSafe), décision Julien 2026-11-11.
-- dossiers : miroir de config/dossiers.json (libellé, intro, seuil), écrit par scripts/classify-dossiers.ts.
-- story_dossiers : probabilité brute rendue par Jev pour chaque (sujet, dossier), y compris les « non ».
-- dossier_stories : sujets retenus (probabilité >= seuil du dossier), lus par api/archive.ts.
-- Changer un seuil = mettre à jour dossiers.threshold, sans nouvel appel à Jev.
create table if not exists public.dossiers (
  slug text primary key,
  label text not null,
  intro text not null,
  threshold real not null check (threshold > 0 and threshold <= 1),
  position int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.story_dossiers (
  story_id text not null,
  dossier text not null references public.dossiers(slug) on delete cascade,
  probability real not null check (probability >= 0 and probability <= 1),
  model text not null,
  classified_at timestamptz not null default now(),
  primary key (story_id, dossier)
);
create index if not exists story_dossiers_dossier_idx on public.story_dossiers (dossier, probability);

-- Lecture et écriture réservées à la clé service (api/archive.ts et le pipeline) : RLS sans policy
alter table public.dossiers enable row level security;
alter table public.story_dossiers enable row level security;

create or replace view public.dossier_stories with (security_invoker = true) as
select f.edition_date, f.id, f.category, f.title, d.slug as dossier, sd.probability
from public.story_dossiers sd
join public.dossiers d on d.slug = sd.dossier
join public.stories_flat f on f.id = sd.story_id
where sd.probability >= d.threshold;

create or replace view public.dossier_counts with (security_invoker = true) as
select d.slug, d.label, d.intro, d.position, count(ds.id)::int as n
from public.dossiers d
left join public.dossier_stories ds on ds.dossier = d.slug
group by d.slug, d.label, d.intro, d.position;
