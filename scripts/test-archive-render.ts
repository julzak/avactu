/**
 * Régression : pages d'archives publiques (api/archive.ts), sans base de données.
 * Garde : le contenu des stories est dans le HTML (lisible sans JavaScript), tout
 * texte venant des stories est échappé, les pages introuvables ne sont pas indexables.
 *
 * Usage: ./node_modules/.bin/tsx scripts/test-archive-render.ts
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildCountries, countryOf, navFromFacets, renderList, slugify, type Facet, type Dossier, MIN_DOSSIER_STORIES,
  esc, frDate, frMonth, monthsBetween, renderEdition, renderIndex, renderNotFound, renderSitemap, renderStory,
  type Story,
} from '../api/archive.js';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures++;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const edition = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', 'stories.json'), 'utf-8'));
const stories: Story[] = edition.stories;
const date = stories[0].id.slice(0, 10);

console.log('--- Sanity check : une story piégée casserait bien une page non échappée ---');
const evil: Story = { ...stories[0], id: `${date}-99`, title: '<script>alert(1)</script> "x"', bullets: ['<img src=x onerror=alert(1)>'], execSummary: 'a</p><script>b</script>' };
check('le titre brut contient une balise', evil.title.includes('<script>'));
check('esc neutralise < > " &', esc('<a href="x">&') === '&lt;a href=&quot;x&quot;&gt;&amp;');

console.log('--- Édition ---');
const ed = renderEdition(date, stories, '2026-01-01', null);
check('tous les titres sont dans le HTML', stories.every((s) => ed.includes(esc(s.title))));
check('toutes les analyses sont dans le HTML', stories.every((s) => ed.includes(esc(s.execSummary.split(/\n{2,}/)[0].trim()))));
check('tous les bullets sont dans le HTML', stories.every((s) => s.bullets.every((b) => ed.includes(esc(b)))));
check('canonical de l\'édition', ed.includes(`<link rel="canonical" href="https://avactu.com/edition/${date}" />`));
check('lien vers chaque story', stories.every((s) => ed.includes(`href="/s/${s.id}"`)));
check('lien précédent présent, suivant absent', ed.includes('href="/edition/2026-01-01"') && !ed.includes('→</a>'));
check('formulaire d\'inscription présent', ed.includes('id="subscribe-form"') && ed.includes("source:src"));
check('date en français', frDate('2026-11-11') === '11 novembre 2026' && ed.includes(frDate(date)));

console.log('--- Story ---');
const st = renderStory(date, stories[0], stories.slice(1));
check('titre en h1', st.includes(`<h1 style="margin-top:8px">${esc(stories[0].title)}</h1>`));
check('JSON-LD NewsArticle', st.includes('"@type":"NewsArticle"'));
check('autres sujets de l\'édition listés', stories.slice(1).every((s) => st.includes(`href="/s/${s.id}"`)));
const evilPage = renderStory(date, evil, []);
check('story piégée : aucune balise script injectée', !evilPage.includes('<script>alert(1)</script>') && !evilPage.includes('<script>b</script>') && !evilPage.includes('<img src=x'));
check('story piégée : JSON-LD ne ferme pas sa balise', !/application\/ld\+json">[^]*?<script>alert/.test(evilPage.split('</head>')[0]));

console.log('--- Index, sitemap, 404 ---');
const months = monthsBetween('2026-02', '2026-11');
check('monthsBetween : 10 mois, du plus récent au plus ancien', months.length === 10 && months[0] === '2026-11' && months[9] === '2026-02');
check('monthsBetween passe le changement d\'année', monthsBetween('2025-11', '2026-02').join() === '2026-02,2026-01,2025-12,2025-11');
check('frMonth', frMonth('2026-02') === 'février 2026');
const idx = renderIndex('2026-11', months, [{ edition_date: date, stories_json: stories }, { edition_date: '2026-09-18', stories_json: [] }]);
check('index : édition listée avec ses titres', idx.includes(`href="/edition/${date}"`) && idx.includes(esc(stories[1].title)));
check('index : édition vide non listée', !idx.includes('/edition/2026-09-18'));
check('index : mois courant en canonical /archives', idx.includes('href="https://avactu.com/archives" />'));
check('index : liens vers les autres mois', idx.includes('href="/archives/2026-02"'));
const sm = renderSitemap([date], months);
check('sitemap : édition et mois', sm.includes(`<loc>https://avactu.com/edition/${date}</loc>`) && sm.includes('/archives/2026-10'));
const nf = renderNotFound();
check('404 : noindex et pas de canonical', nf.includes('content="noindex"') && !nf.includes('rel="canonical"'));

console.log('--- Rubriques et pays ---');
check('slugify : accents et espaces', slugify('États-Unis') === 'etats-unis' && slugify("Détroit d'Ormuz") === 'detroit-d-ormuz');
check('countryOf : alias et lieu inconnu', countryOf('Californie') === 'États-Unis' && countryOf('Gaza') === 'Territoires palestiniens' && countryOf('Kenya') === 'Kenya');
check('countryOf : lieux contestés non rattachés', countryOf('Jérusalem') === 'Jérusalem' && countryOf('Crimée') === 'Crimée');
const facets: Facet[] = [
  { kind: 'category', key: 'geopolitique', n: 887 }, { kind: 'category', key: 'culture', n: 3 },
  { kind: 'place', key: 'États-Unis', n: 186 }, { kind: 'place', key: 'Californie', n: 41 }, { kind: 'place', key: 'Etats-Unis', n: 4 },
  { kind: 'place', key: 'Kenya', n: 4 }, { kind: 'place', key: 'Cisjordanie', n: 13 },
];
const countries = buildCountries(facets);
const us = countries.find((c) => c.slug === 'etats-unis');
check('États-Unis regroupe ses lieux (186+41+4)', us?.n === 231 && us.places.length === 3);
check('pays sous le seuil exclu (Kenya, 4 sujets)', !countries.some((c) => c.name === 'Kenya'));
check('tri par nombre de sujets', countries[0].name === 'États-Unis');
const nav = navFromFacets(facets);
check('nav : rubriques présentes, vides absentes', nav.rubriques.some((r) => r.slug === 'culture') && !nav.rubriques.some((r) => r.slug === 'tech'));
const items = stories.map((s) => ({ edition_date: date, id: s.id, category: s.category, title: s.title }));
const list = renderList({ kind: 'pays', slug: 'etats-unis', label: 'États-Unis', intro: 'Intro.', items, page: 1, total: 231 });
check('liste pays : titres et liens', stories.every((s) => list.includes(`href="/s/${s.id}"`)));
check('liste pays : page suivante, pas de précédente', list.includes('href="/pays/etats-unis/2"') && !list.includes('Plus récents'));
const list3 = renderList({ kind: 'pays', slug: 'etats-unis', label: 'États-Unis', intro: 'Intro.', items, page: 3, total: 231 });
check('liste pays : dernière page, retour vers page 2, canonical /3', list3.includes('href="/pays/etats-unis/2"') && !list3.includes('Plus anciens') && list3.includes('href="https://avactu.com/pays/etats-unis/3" />'));
const smNav = renderSitemap([date], months, nav);
check('sitemap : rubriques et pays', smNav.includes('/rubrique/geopolitique</loc>') && smNav.includes('/pays/etats-unis</loc>'));
const edLinks = renderEdition(date, stories, null, null, new Set(countries.map((c) => c.slug)));
check('édition : badge lié à la rubrique', edLinks.includes('href="/rubrique/'));

console.log('--- Dossiers thématiques ---');
const dossiers: Dossier[] = [
  { slug: 'guerre-en-ukraine', label: 'Guerre en Ukraine', intro: "L'invasion russe.", n: 174 },
  { slug: 'presque-vide', label: 'Presque vide', intro: 'x', n: MIN_DOSSIER_STORIES - 1 },
  { slug: 'evil', label: '<script>alert(1)</script>', intro: 'x', n: 50 },
];
const navD = navFromFacets(facets, dossiers);
check('nav : dossier sous le seuil exclu', navD.dossiers.some((d) => d.slug === 'guerre-en-ukraine') && !navD.dossiers.some((d) => d.slug === 'presque-vide'));
const idxD = renderIndex('2026-11', months, [{ edition_date: date, stories_json: stories }], navD);
check('archives : section Les dossiers avec lien', idxD.includes('Les dossiers') && idxD.includes('href="/dossier/guerre-en-ukraine"'));
check('archives : libellé de dossier échappé', !idxD.includes('<script>alert(1)</script>') && idxD.includes('&lt;script&gt;'));
const smD = renderSitemap([date], months, navD);
check('sitemap : dossiers retenus seulement', smD.includes('/dossier/guerre-en-ukraine</loc>') && !smD.includes('/dossier/presque-vide'));
const listD = renderList({ kind: 'dossier', slug: 'guerre-en-ukraine', label: 'Guerre en Ukraine', intro: "L'invasion russe.", items, page: 2, total: 174 });
check('liste dossier : titre, canonical page 2, retour page 1', listD.includes('Guerre en Ukraine : le dossier') && listD.includes('href="https://avactu.com/dossier/guerre-en-ukraine/2" />') && listD.includes('href="/dossier/guerre-en-ukraine"'));
check('liste dossier : sujets avec badge de rubrique', stories.every((s) => listD.includes(`href="/s/${s.id}"`)) && listD.includes('class="badge"'));
const sd = new Map([[stories[0].id, [dossiers[0]]]]);
const stD = renderStory(date, stories[0], stories.slice(1), new Set(), sd);
check('sujet : lien vers son dossier', stD.includes('<p class="dossiers">Dossier : <a href="/dossier/guerre-en-ukraine">Guerre en Ukraine</a></p>'));
const edD = renderEdition(date, stories, null, null, new Set(), sd);
check('édition : lien dossier sur le seul sujet classé', (edD.match(/class="dossiers"/g) || []).length === 1);
check('sujet sans dossier : pas de ligne vide', !renderStory(date, stories[1], []).includes('class="dossiers"'));

console.log(failures ? `\n❌ ${failures} échec(s)` : '\n✅ Tout passe');
process.exit(failures ? 1 : 0);
