/**
 * Classe les sujets publiés (newsletter_editions) dans les dossiers thématiques via Jev
 * et écrit les probabilités dans story_dossiers. Seuls les couples (sujet, dossier) absents
 * de la table sont envoyés à Jev : relancer le script rattrape un run raté, et ajouter un
 * dossier ne coûte qu'une question par sujet.
 *
 * Usage :
 *   tsx scripts/classify-dossiers.ts               # éditions des 14 derniers jours (pipeline du matin)
 *   tsx scripts/classify-dossiers.ts --days=60
 *   tsx scripts/classify-dossiers.ts --all         # tout l'historique
 *   tsx scripts/classify-dossiers.ts --all --only=climat,chine
 *   tsx scripts/classify-dossiers.ts --sync        # recopie config/dossiers.json (libellés, seuils) sans appeler Jev
 *
 * Env : SUPABASE_URL, SUPABASE_SERVICE_KEY, TYPESAFE_API_KEY.
 * Code de sortie 1 si un sujet n'a pas pu être classé (les autres sont quand même enregistrés).
 */
import { createClient } from '@supabase/supabase-js';
import { classifyStory, loadDossiersConfig, mapLimit, thresholdOf, type StoryForJev } from './dossiers-jev.js';

const args = process.argv.slice(2);
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ALL = args.includes('--all');
const SYNC_ONLY = args.includes('--sync');
const DAYS = Number(arg('days') ?? 14);
const ONLY = arg('only')?.split(',').filter(Boolean);
const CONCURRENCY = Number(arg('concurrency') ?? 6);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY manquante');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);
const cfg = loadDossiersConfig();

// 1. Miroir de la config (libellés, intros, seuils) dans la table dossiers
{
  const { error } = await supabase.from('dossiers').upsert(
    cfg.dossiers.map((d, i) => ({
      slug: d.slug, label: d.label, intro: d.intro, threshold: thresholdOf(cfg, d), position: i,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'slug' }
  );
  if (error) {
    console.error('❌ Mise à jour de la table dossiers :', error.message);
    process.exit(1);
  }
  console.log(`📁 ${cfg.dossiers.length} dossiers synchronisés (seuil global ${cfg.threshold})`);
}
if (SYNC_ONLY) process.exit(0);

const apiKey = process.env.TYPESAFE_API_KEY;
if (!apiKey) {
  console.error('❌ TYPESAFE_API_KEY manquante : sujets non classés, rattrapage au prochain run');
  process.exit(1);
}

const dossiers = ONLY ? cfg.dossiers.filter((d) => ONLY.includes(d.slug)) : cfg.dossiers;
if (dossiers.length === 0) throw new Error(`aucun dossier ne correspond à --only=${ONLY}`);

// 2. Sujets publiés sur la période
const stories: StoryForJev[] = [];
{
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  const PAGE = 40;
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('newsletter_editions').select('edition_date, stories_json').order('edition_date');
    if (!ALL) q = q.gte('edition_date', since);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`lecture newsletter_editions : ${error.message}`);
    for (const row of data ?? []) stories.push(...((row.stories_json ?? []) as StoryForJev[]).filter((s) => s?.id));
    if (!data || data.length < PAGE) break;
  }
}

// 3. Couples déjà classés
const done = new Set<string>();
for (let i = 0; i < stories.length; i += 100) {
  const ids = stories.slice(i, i + 100).map((s) => s.id);
  const { data, error } = await supabase.from('story_dossiers').select('story_id, dossier').in('story_id', ids).limit(1000);
  if (error) throw new Error(`lecture story_dossiers : ${error.message}`);
  for (const r of data ?? []) done.add(`${r.story_id}|${r.dossier}`);
}

const todo = stories
  .map((s) => ({ story: s, missing: dossiers.filter((d) => !done.has(`${s.id}|${d.slug}`)) }))
  .filter((t) => t.missing.length > 0);
console.log(`📰 ${stories.length} sujets ${ALL ? 'au total' : `sur ${DAYS} jours`}, ${todo.length} à classer (${dossiers.length} dossiers)`);

// 4. Classement par Jev, écriture au fil de l'eau par paquets
const failures: string[] = [];
let written = 0;
let buffer: { story_id: string; dossier: string; probability: number; model: string }[] = [];
const flush = async () => {
  if (buffer.length === 0) return;
  const rows = buffer;
  buffer = [];
  const { error } = await supabase.from('story_dossiers').upsert(rows, { onConflict: 'story_id,dossier' });
  if (error) {
    failures.push(`écriture de ${rows.length} lignes : ${error.message}`);
  } else {
    written += rows.length;
  }
};

const t0 = Date.now();
await mapLimit(todo, CONCURRENCY, async ({ story, missing }, i) => {
  try {
    const r = await classifyStory(story, missing, apiKey, cfg.model);
    for (const d of missing) buffer.push({ story_id: story.id, dossier: d.slug, probability: r.probabilities[d.slug], model: r.model });
    if (buffer.length >= 300) await flush();
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  }
  if ((i + 1) % 100 === 0) console.log(`   ${i + 1}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
});
await flush();

console.log(`✅ ${written} probabilités enregistrées en ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// 5. Bilan par dossier (sujets retenus au seuil)
const { data: counts, error: countErr } = await supabase.from('dossier_counts').select('slug, n').order('position');
if (countErr) console.warn('⚠️  Lecture dossier_counts :', countErr.message);
else console.log('📊 Sujets par dossier : ' + (counts ?? []).map((c) => `${c.slug} ${c.n}`).join(', '));

if (failures.length > 0) {
  console.error(`❌ ${failures.length} échec(s), rattrapage au prochain run :`);
  for (const f of failures.slice(0, 20)) console.error(`   ${f}`);
  process.exit(1);
}
