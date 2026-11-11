-- Vues pour les pages rubrique et pays (api/archive.ts). Décision Julien 2026-11-11.
-- stories_flat : une ligne par sujet, dépliée depuis newsletter_editions.stories_json.
-- stories_facets : décomptes par rubrique et par lieu (moins de 1000 lignes, limite PostgREST).
create or replace view public.stories_flat with (security_invoker = true) as
select e.edition_date,
       st->>'id' as id,
       case when st->>'category' = 'economie' then 'eco' else st->>'category' end as category,
       st->>'title' as title,
       st->'location'->>'name' as location_name,
       trim(split_part(st->'location'->>'name', ',', -1)) as place
from public.newsletter_editions e
cross join lateral jsonb_array_elements(e.stories_json) st;

create or replace view public.stories_facets with (security_invoker = true) as
select 'category'::text as kind, category as key, count(*)::int as n from public.stories_flat group by category
union all
select 'place'::text, place, count(*)::int from public.stories_flat group by place;
