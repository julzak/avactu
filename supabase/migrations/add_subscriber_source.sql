-- Origine de l'inscription (site, archives, email, linkedin...) pour mesurer l'acquisition.
-- Décision Julien 2026-11-11. NULL pour les abonnés antérieurs.
alter table public.subscribers add column if not exists source text;
