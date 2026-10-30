/**
 * Régression : catégorie « culture » (décision Julien 2026-10-30).
 * Origine : édition du 2026-10-30, mort de Patrick Stewart publiée en géopolitique.
 * Le modèle avait classé la story « tech », le garde-fou de 2026-03-10 l'a renvoyée
 * dans la catégorie de son cluster (celle du flux RSS), et le comptage des créneaux
 * fait avant ce revert a produit 4 stories géopo au lieu de 3.
 *
 * Usage: ./node_modules/.bin/tsx scripts/test-culture-slot.ts
 */

import { CULTURE_MIN_SOURCES, resolveStoryCategory } from './category-rules.js';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures++;
}

/** Garde-fou d'origine (synthesize.ts, 2026-03-10 puis 2026-09-29) : reproduit tel quel */
function legacyGuard(modelCategory: string, clusterCategory: 'geopolitique' | 'tech' | 'eco'): string {
  const allowedPolitique = modelCategory === 'politique' && clusterCategory === 'geopolitique';
  return modelCategory !== clusterCategory && !allowedPolitique ? clusterCategory : modelCategory;
}

// Cluster Stewart du 2026-10-30 : flux géopo (Courrier International, France 24, RFI)
const STEWART_SOURCES = 3;

console.log('--- Sanity check : l\'ancien garde-fou produit bien le bug ---');
check(
  'ancien garde-fou : culture sur cluster géopo → geopolitique (le bug)',
  legacyGuard('culture', 'geopolitique') === 'geopolitique'
);

console.log('\n--- Règle culture ---');
const stewart = resolveStoryCategory('culture', 'geopolitique', STEWART_SOURCES);
check(
  `Stewart (${STEWART_SOURCES} sources) → publié en culture`,
  stewart.action === 'keep' && stewart.category === 'culture',
  JSON.stringify(stewart)
);
const single = resolveStoryCategory('culture', 'geopolitique', 1);
check('people repris par 1 source → écarté', single.action === 'drop', JSON.stringify(single));
const below = resolveStoryCategory('culture', 'geopolitique', CULTURE_MIN_SOURCES - 1);
check(`culture à ${CULTURE_MIN_SOURCES - 1} sources → écarté (seuil strict)`, below.action === 'drop');
const fromTech = resolveStoryCategory('culture', 'tech', 4);
check('culture sortie d\'un cluster tech très repris → publié en culture', fromTech.action === 'keep' && fromTech.category === 'culture');

console.log('\n--- Règles inchangées ---');
const pol = resolveStoryCategory('politique', 'geopolitique', 2);
check('politique sur cluster géopo → politique', pol.action === 'keep' && pol.category === 'politique' && !pol.reverted);
const polTech = resolveStoryCategory('politique', 'tech', 3);
check('politique sur cluster tech → renvoyé en tech', polTech.action === 'keep' && polTech.category === 'tech' && polTech.reverted);
const eco = resolveStoryCategory('eco', 'geopolitique', 3);
check('eco sur cluster géopo → renvoyé en geopolitique (géopo dominante)', eco.action === 'keep' && eco.category === 'geopolitique' && eco.reverted);
const techOnGeo = resolveStoryCategory('tech', 'geopolitique', 3);
check('tech sur cluster géopo → renvoyé en geopolitique', techOnGeo.action === 'keep' && techOnGeo.category === 'geopolitique' && techOnGeo.reverted);
const same = resolveStoryCategory('tech', 'tech', 1);
check('même catégorie → gardée sans revert', same.action === 'keep' && same.category === 'tech' && !same.reverted);
const missing = resolveStoryCategory(undefined, 'eco', 1);
check('catégorie absente → celle du cluster', missing.action === 'keep' && missing.category === 'eco' && !missing.reverted);

console.log(failures === 0 ? '\n✅ test-culture-slot : tout passe' : `\n❌ test-culture-slot : ${failures} échec(s)`);
if (failures > 0) process.exit(1);
