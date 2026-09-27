/**
 * Régression : mode suivi (constat 2026-09-27, slot éco sur "Flambée des carburants"
 * 13 éditions d'affilée). Deux causes gardées ici :
 *   1. l'étape de synthèse du workflow ne recevait pas les variables Supabase,
 *      donc l'historique revenait vide ;
 *   2. sans historique dans le prompt, le modèle ne peut pas savoir ce qui est déjà publié.
 *
 * Usage: ./node_modules/.bin/tsx scripts/test-follow-up.ts
 */

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildFollowUpBlock, fetchRecentStories, toRecentStories } from './follow-up.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = '.github/workflows/update-content.yml';
// Dernier commit avant le correctif : workflow bogué d'origine
const BUGGY_COMMIT = 'f239ae0';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures++;
}

/** Variables d'env déclarées sur l'étape qui lance `npm run synthesize` */
function synthesizeStepEnv(workflow: string): string[] {
  const steps = workflow.split(/\n {6}- name: /);
  const step = steps.find((s) => /run: npm run synthesize\b/.test(s));
  if (!step) return [];
  return [...step.matchAll(/^ {10}([A-Z_]+):/gm)].map((m) => m[1]);
}

// Édition réelle du 2026-09-26 (newsletter_editions), réduite aux champs utiles
const EDITION_0926 = [
  {
    category: 'eco',
    title: 'Le diesel flambe et bat des records en Europe',
    bullets: ['Le diesel atteint un record en Europe.', 'La crise du détroit d\'Ormuz réduit l\'offre.'],
  },
  { category: 'geopolitique', title: 'L\'Arabie saoudite intercepte de nouvelles attaques houthies', bullets: [] },
  { category: 'tech' },
];

async function main(): Promise<void> {
  // 1. Workflow : l'étape de synthèse reçoit les variables Supabase
  let buggyWorkflow: string | null = null;
  try {
    buggyWorkflow = execFileSync('git', ['show', `${BUGGY_COMMIT}:${WORKFLOW}`], { cwd: ROOT, encoding: 'utf-8' });
  } catch {
    console.log(`- sanity workflow ignoré : commit ${BUGGY_COMMIT} absent (clone superficiel)`);
  }
  if (buggyWorkflow) {
    const buggyEnv = synthesizeStepEnv(buggyWorkflow);
    check('sanity: étape de synthèse trouvée dans le workflow d\'origine', buggyEnv.includes('ANTHROPIC_API_KEY'), `env=${buggyEnv}`);
    check('sanity: le workflow d\'origine n\'avait pas les variables Supabase', !buggyEnv.includes('SUPABASE_URL'));
  }
  const env = synthesizeStepEnv(readFileSync(join(ROOT, WORKFLOW), 'utf-8'));
  check('workflow: SUPABASE_URL sur l\'étape de synthèse', env.includes('SUPABASE_URL'), `env=${env}`);
  check('workflow: SUPABASE_SERVICE_KEY sur l\'étape de synthèse', env.includes('SUPABASE_SERVICE_KEY'), `env=${env}`);

  // 2. Sans variables Supabase : historique vide, mais avec un avertissement
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')); };
  const withoutEnv = await fetchRecentStories();
  console.warn = originalWarn;
  if (saved.url) process.env.SUPABASE_URL = saved.url;
  if (saved.key) process.env.SUPABASE_SERVICE_KEY = saved.key;
  check('sans env: historique vide', withoutEnv.length === 0);
  check('sans env: avertissement émis', warnings.some((w) => /mode suivi désactivé/.test(w)), `warnings=${warnings.length}`);

  // 3. Lecture d'une édition : stories sans titre écartées, date normalisée
  const recent = toRecentStories('2026-09-26T00:00:00+00:00', EDITION_0926);
  check('édition: 2 stories lues sur 3 (une sans titre)', recent.length === 2, `n=${recent.length}`);
  check('édition: date au format AAAA-MM-JJ', recent[0]?.date === '2026-09-26', `date=${recent[0]?.date}`);
  check('édition: stories_json invalide → aucune story', toRecentStories('2026-09-26', null).length === 0);

  // 4. Bloc de prompt
  check('bloc: vide sans historique (prompt inchangé)', buildFollowUpBlock([], 'cluster') === '' && buildFollowUpBlock([], 'pool') === '');
  const cluster = buildFollowUpBlock(recent, 'cluster');
  const pool = buildFollowUpBlock(recent, 'pool');
  check('bloc: titre déjà publié présent', cluster.includes('[2026-09-26] Le diesel flambe et bat des records en Europe'));
  check('bloc: bullets déjà publiés présents', cluster.includes('  - Le diesel atteint un record en Europe.'));
  check('bloc cluster: sortie rien_de_nouveau proposée', cluster.includes('"rien_de_nouveau"'));
  check('bloc pool: pas de rien_de_nouveau, consigne de changer de sujet', !pool.includes('rien_de_nouveau') && pool.includes('choisis un AUTRE sujet'));
  check('bloc: aucun tiret cadratin', !/[—–]/.test(cluster + pool));

  if (failures > 0) {
    console.error(`\n❌ ${failures} échec(s)`);
    process.exit(1);
  }
  console.log('\n✅ Tous les tests passent');
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
