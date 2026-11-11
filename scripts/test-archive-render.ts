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

console.log(failures ? `\n❌ ${failures} échec(s)` : '\n✅ Tout passe');
process.exit(failures ? 1 : 0);
