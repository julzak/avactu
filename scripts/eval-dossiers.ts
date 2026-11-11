/**
 * Juge fixe des dossiers thématiques : score Jev sur le jeu de contrôle figé
 * (data/dossiers-gold.json). Les réponses brutes de Jev sont gardées dans
 * data/dossiers-gold-answers.json pour recalculer le score sans nouvel appel.
 *
 * Usage :
 *   tsx --env-file=.env.local scripts/eval-dossiers.ts           # appelle Jev, écrit les réponses, affiche le score
 *   tsx scripts/eval-dossiers.ts --cached                         # recalcule le score depuis les réponses gardées
 *   tsx scripts/eval-dossiers.ts --cached --threshold=0.6         # score à un autre seuil
 *
 * Règle (CLAUDE.md, juge fixe) : une modification à la fois (description, seuil), on garde si le
 * score monte ou reste égal avec plus simple, sinon on revient. Les essais sont notés dans checks.md.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classifyStory, loadDossiersConfig, mapLimit, thresholdOf, type StoryForJev } from './dossiers-jev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLD = join(__dirname, '..', 'data', 'dossiers-gold.json');
const ANSWERS = join(__dirname, '..', 'data', 'dossiers-gold-answers.json');

interface GoldItem { story: StoryForJev; labels: Record<string, boolean | null> }
interface Answers { model: string; config_hash: string; probabilities: Record<string, Record<string, number>> }

const args = process.argv.slice(2);
const cached = args.includes('--cached');
const thresholdArg = args.find((a) => a.startsWith('--threshold='));

const cfg = loadDossiersConfig();
const gold = JSON.parse(readFileSync(GOLD, 'utf-8')) as { items: GoldItem[] };
const configHash = JSON.stringify(cfg.dossiers.map((d) => [d.slug, d.label, d.relevant, d.not_relevant]));

let answers: Answers;
if (cached) {
  if (!existsSync(ANSWERS)) throw new Error('pas de réponses gardées : lancer sans --cached');
  answers = JSON.parse(readFileSync(ANSWERS, 'utf-8'));
  if (answers.config_hash !== configHash) console.warn('⚠️  Les descriptions ont changé depuis ces réponses : relancer sans --cached');
} else {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('TYPESAFE_API_KEY manquante');
  const t = Date.now();
  const results = await mapLimit(gold.items, 6, (it) => classifyStory(it.story, cfg.dossiers, key, cfg.model));
  answers = {
    model: results[0].model,
    config_hash: configHash,
    probabilities: Object.fromEntries(gold.items.map((it, i) => [it.story.id, results[i].probabilities])),
  };
  writeFileSync(ANSWERS, JSON.stringify(answers, null, 1) + '\n');
  console.log(`${gold.items.length} sujets classés en ${((Date.now() - t) / 1000).toFixed(1)} s (${answers.model})\n`);
}

interface Score { tp: number; fp: number; fn: number; tn: number }
const f1 = (s: Score) => (2 * s.tp) / Math.max(1, 2 * s.tp + s.fp + s.fn);
const pct = (x: number) => `${(100 * x).toFixed(0)} %`;

function scoreAt(slug: string, threshold: number): Score {
  const s: Score = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const it of gold.items) {
    const label = it.labels[slug];
    if (label === null || label === undefined) continue; // cas limite : exclu
    const yes = answers.probabilities[it.story.id][slug] >= threshold;
    if (yes && label) s.tp++;
    else if (yes) s.fp++;
    else if (label) s.fn++;
    else s.tn++;
  }
  return s;
}

function micro(thresholdFor: (slug: string) => number): Score {
  return cfg.dossiers.reduce<Score>((acc, d) => {
    const s = scoreAt(d.slug, thresholdFor(d.slug));
    return { tp: acc.tp + s.tp, fp: acc.fp + s.fp, fn: acc.fn + s.fn, tn: acc.tn + s.tn };
  }, { tp: 0, fp: 0, fn: 0, tn: 0 });
}

const fixed = thresholdArg ? Number(thresholdArg.split('=')[1]) : null;
const thr = (slug: string) => fixed ?? thresholdOf(cfg, cfg.dossiers.find((d) => d.slug === slug)!);

console.log(`Seuil ${fixed ?? `config (global ${cfg.threshold})`}`);
console.log('dossier                      préc.  rappel  F1    VP FP FN');
for (const d of cfg.dossiers) {
  const s = scoreAt(d.slug, thr(d.slug));
  const prec = s.tp / Math.max(1, s.tp + s.fp);
  const rec = s.tp / Math.max(1, s.tp + s.fn);
  console.log(`${d.slug.padEnd(28)} ${pct(prec).padStart(5)} ${pct(rec).padStart(6)}  ${f1(s).toFixed(2)}  ${String(s.tp).padStart(2)} ${String(s.fp).padStart(2)} ${String(s.fn).padStart(2)}`);
}
const m = micro(thr);
console.log(`MICRO                        ${pct(m.tp / Math.max(1, m.tp + m.fp)).padStart(5)} ${pct(m.tp / Math.max(1, m.tp + m.fn)).padStart(6)}  ${f1(m).toFixed(2)}  ${m.tp} ${m.fp} ${m.fn}`);

console.log('\nBalayage du seuil global (F1 micro) :');
for (let t = 0.1; t < 0.95; t += 0.1) {
  const s = micro(() => t);
  console.log(`  ${t.toFixed(1)}  F1 ${f1(s).toFixed(3)}  VP ${s.tp} FP ${s.fp} FN ${s.fn}`);
}

if (args.includes('--errors')) {
  console.log('\nErreurs au seuil courant :');
  for (const it of gold.items) {
    for (const d of cfg.dossiers) {
      const label = it.labels[d.slug];
      if (label === null) continue;
      const p = answers.probabilities[it.story.id][d.slug];
      const yes = p >= thr(d.slug);
      if (yes !== label) console.log(`  ${label ? 'FN' : 'FP'} ${p.toFixed(2)} ${d.slug} :: ${it.story.id} ${it.story.title}`);
    }
  }
}
