/**
 * Archives publiques rendues côté serveur (décision Julien 2026-11-11, chantier acquisition).
 * Une seule fonction pour quatre vues, routées par vercel.json :
 *   /archives, /archives/:month   → view=index
 *   /edition/:date                → view=edition
 *   /s/:id                        → view=story (remplace l'ancienne redirection vers l'app,
 *                                   qui ne marchait que pour l'édition du jour)
 *   /sitemap.xml                  → view=sitemap
 * Source : table newsletter_editions (une ligne par édition, stories_json).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export interface Story {
  id: string;
  category: string;
  title: string;
  imageUrl: string;
  location?: { name?: string };
  bullets: string[];
  execSummary: string;
  sources?: string[];
  publishedAt?: string;
}

interface EditionRow {
  edition_date: string;
  stories_json: Story[];
}

const APP_URL = (process.env.APP_URL || 'https://avactu.com').replace(/\/$/, '');
const CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

const CATEGORIES: Record<string, { label: string; color: string }> = {
  geopolitique: { label: 'Géopolitique', color: '#f43f5e' },
  politique: { label: 'Politique', color: '#a78bfa' },
  tech: { label: 'Tech', color: '#38bdf8' },
  eco: { label: 'Éco', color: '#34d399' },
  economie: { label: 'Éco', color: '#34d399' },
  culture: { label: 'Culture', color: '#f59e0b' },
};

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** "2026-11-11" → "11 novembre 2026" */
export function frDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** "2026-11" → "novembre 2026" */
export function frMonth(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** Mois de `first` à `last` inclus, du plus récent au plus ancien */
export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  let [y, m] = last.split('-').map(Number);
  const [fy, fm] = first.split('-').map(Number);
  while (y > fy || (y === fy && m >= fm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return months;
}

function badge(category: string): string {
  const c = CATEGORIES[category] ?? { label: category, color: '#94a3b8' };
  return `<span class="badge" style="color:${c.color};border-color:${c.color}55">${esc(c.label)}</span>`;
}

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#05070A;color:#f8fafc;font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.6}
a{color:#22d3ee;text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:720px;margin:0 auto;padding:0 20px}
header.top{border-bottom:1px solid rgba(148,163,184,.2);padding:14px 0}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{display:flex;align-items:center;gap:10px;color:#f8fafc;font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:20px}
.brand img{width:32px;height:32px}
nav a{font-family:'JetBrains Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-left:16px}
h1{font-family:'Playfair Display',Georgia,serif;font-size:30px;line-height:1.2;margin:32px 0 8px}
h2{font-family:'Playfair Display',Georgia,serif;font-size:22px;line-height:1.3;margin:10px 0}
h2 a{color:#f8fafc}
.meta{font-family:'JetBrains Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8}
.lead{color:#94a3b8;margin:0 0 24px}
.badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:1px;border:1px solid;border-radius:4px;padding:1px 6px;margin-right:8px}
article{padding:28px 0;border-bottom:1px solid rgba(148,163,184,.2)}
article img{width:100%;aspect-ratio:1200/630;object-fit:cover;border-radius:10px;background:#0f172a}
ul.bullets{padding-left:20px;margin:12px 0;color:#cbd5e1}
ul.bullets li{margin:4px 0}
.summary p{margin:12px 0;color:#e2e8f0}
.sources{font-size:13px;color:#64748b}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:6px 0}
.day{padding:16px 0;border-bottom:1px solid rgba(148,163,184,.2)}
.day>a{font-family:'JetBrains Mono',monospace;font-size:13px;text-transform:uppercase;letter-spacing:1px}
.day li a{color:#e2e8f0}
.months{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}
.months a,.months span{font-family:'JetBrains Mono',monospace;font-size:12px;border:1px solid rgba(148,163,184,.3);border-radius:6px;padding:4px 10px;color:#94a3b8}
.months span{color:#05070A;background:#22d3ee;border-color:#22d3ee}
.pager{display:flex;justify-content:space-between;gap:12px;padding:24px 0;font-size:14px}
.cta{margin:32px 0;padding:24px;border:1px solid rgba(34,211,238,.35);border-radius:12px;background:#0b1220}
.cta h3{margin:0 0 6px;font-family:'Playfair Display',Georgia,serif;font-size:20px}
.cta p{margin:0 0 14px;color:#94a3b8;font-size:14px}
.cta form{display:flex;flex-wrap:wrap;gap:8px}
.cta input,.cta select,.cta button{font:inherit;font-size:14px;padding:10px 12px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:#05070A;color:#f8fafc}
.cta input{flex:1 1 200px;min-width:0}
.cta button{background:#22d3ee;color:#05070A;border-color:#22d3ee;font-weight:600;cursor:pointer}
.cta .msg{margin:10px 0 0;font-size:13px;min-height:1em}
footer{padding:32px 0 48px;color:#64748b;font-size:13px}
`;

const SUBSCRIBE_BLOCK = `
<section class="cta" id="abonnement">
  <h3>Reçois Avactu par email</h3>
  <p>L'actualité mondiale en 15 minutes, au niveau d'un adulte, sans le bruit. Gratuit, désabonnement en un clic.</p>
  <form id="subscribe-form">
    <input type="email" name="email" required placeholder="ton@email.fr" autocomplete="email" aria-label="Adresse email" />
    <select name="frequency" aria-label="Fréquence">
      <option value="biweekly">Tous les 2 jours</option>
      <option value="daily">Tous les jours</option>
      <option value="weekly">Chaque samedi</option>
    </select>
    <button type="submit">Je m'abonne</button>
  </form>
  <p class="msg" id="subscribe-msg" role="status"></p>
</section>`;

const SUBSCRIBE_SCRIPT = `
<script>
(function(){
  var form=document.getElementById('subscribe-form');if(!form)return;
  var msg=document.getElementById('subscribe-msg');
  var src=new URLSearchParams(location.search).get('src')||'archives';
  form.addEventListener('submit',function(e){
    e.preventDefault();
    msg.textContent='Envoi...';
    fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:form.email.value.trim().toLowerCase(),frequency:form.frequency.value,source:src})})
    .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Erreur');})})
    .then(function(){msg.textContent="C'est presque fait : confirme dans l'email que tu vas recevoir.";form.reset();})
    .catch(function(){msg.textContent="L'inscription n'a pas marché. Réessaie dans un instant.";});
  });
})();
</script>`;

interface PageOptions {
  title: string;
  description: string;
  path: string;
  body: string;
  image?: string;
  ogType?: 'website' | 'article';
  jsonLd?: object;
  noindex?: boolean;
}

export function page(o: PageOptions): string {
  const url = `${APP_URL}${o.path}`;
  const image = o.image || `${APP_URL}/og-image.png`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}" />
${o.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${esc(url)}" />`}
<meta property="og:type" content="${o.ogType || 'website'}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(o.title)}" />
<meta property="og:description" content="${esc(o.description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:site_name" content="Avactu" />
<meta property="og:locale" content="fr_FR" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${CSS}</style>
${o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/favicon.svg" alt="" />Avactu</a>
  <nav><a href="/">Édition du jour</a><a href="/archives">Archives</a></nav>
</div></header>
<main class="wrap">
${o.body}
${SUBSCRIBE_BLOCK}
</main>
<footer><div class="wrap">Avactu : l'essentiel, sans le bruit. Synthèses rédigées à partir de sources de presse citées sous chaque sujet.</div></footer>
${SUBSCRIBE_SCRIPT}
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

function storyArticle(story: Story, opts: { headingLink: boolean; lazy: boolean }): string {
  const paragraphs = String(story.execSummary || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
  const title = opts.headingLink
    ? `<h2><a href="/s/${esc(story.id)}">${esc(story.title)}</a></h2>`
    : '';
  return `<article>
  ${story.imageUrl ? `<img src="${esc(story.imageUrl)}" alt="" ${opts.lazy ? 'loading="lazy"' : ''} referrerpolicy="no-referrer" />` : ''}
  <p class="meta" style="margin:14px 0 0">${badge(story.category)}${esc(story.location?.name || '')}</p>
  ${title}
  <ul class="bullets">${(story.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
  <div class="summary">${paragraphs}</div>
  ${story.sources?.length ? `<p class="sources">Sources : ${esc(story.sources.join(', '))}</p>` : ''}
</article>`;
}

export function renderEdition(date: string, stories: Story[], prev: string | null, next: string | null): string {
  const titles = stories.map((s) => s.title).join(' · ');
  return page({
    title: `Actualité du ${frDate(date)} : ${stories[0].title} | Avactu`,
    description: `L'essentiel de l'actualité mondiale du ${frDate(date)} : ${titles}`.slice(0, 300),
    path: `/edition/${date}`,
    image: stories[0].imageUrl,
    ogType: 'article',
    body: `<p class="meta" style="margin-top:32px">Édition du ${esc(frDate(date))}</p>
<h1 style="margin-top:8px">L'actualité mondiale du ${esc(frDate(date))}</h1>
<p class="lead">${stories.length} sujets pour comprendre ce qui s'est passé, avec les points de vue de chaque acteur.</p>
${stories.map((s, i) => storyArticle(s, { headingLink: true, lazy: i > 0 })).join('\n')}
<div class="pager">
  <span>${prev ? `<a href="/edition/${prev}">← ${esc(frDate(prev))}</a>` : ''}</span>
  <span>${next ? `<a href="/edition/${next}">${esc(frDate(next))} →</a>` : ''}</span>
</div>`,
  });
}

export function renderStory(date: string, story: Story, others: Story[]): string {
  return page({
    title: `${story.title} | Avactu`,
    description: (story.bullets || []).slice(0, 2).join(' ').slice(0, 300),
    path: `/s/${story.id}`,
    image: story.imageUrl,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: story.title,
      datePublished: story.publishedAt || `${date}T06:00:00Z`,
      image: story.imageUrl ? [story.imageUrl] : undefined,
      inLanguage: 'fr',
      mainEntityOfPage: `${APP_URL}/s/${story.id}`,
      author: { '@type': 'Organization', name: 'Avactu' },
      publisher: { '@type': 'Organization', name: 'Avactu', logo: { '@type': 'ImageObject', url: `${APP_URL}/logo.png` } },
    },
    body: `<p class="meta" style="margin-top:32px"><a href="/edition/${date}">Édition du ${esc(frDate(date))}</a></p>
<h1 style="margin-top:8px">${esc(story.title)}</h1>
${storyArticle(story, { headingLink: false, lazy: false })}
${others.length ? `<h2 style="margin-top:28px">Dans la même édition</h2>
<ul class="plain">${others.map((s) => `<li>${badge(s.category)}<a href="/s/${esc(s.id)}">${esc(s.title)}</a></li>`).join('')}</ul>` : ''}`,
  });
}

export function renderIndex(month: string, months: string[], editions: EditionRow[]): string {
  const days = editions
    .filter((e) => Array.isArray(e.stories_json) && e.stories_json.length > 0)
    .map((e) => `<div class="day">
  <a href="/edition/${e.edition_date}">${esc(frDate(e.edition_date))}</a>
  <ul class="plain">${e.stories_json.map((s) => `<li>${badge(s.category)}<a href="/s/${esc(s.id)}">${esc(s.title)}</a></li>`).join('')}</ul>
</div>`)
    .join('\n');
  const isLatest = month === months[0];
  return page({
    title: `Archives ${frMonth(month)} : l'actualité mondiale expliquée | Avactu`,
    description: `Toutes les éditions d'Avactu de ${frMonth(month)} : géopolitique, tech, économie et culture, expliquées en 15 minutes avec les points de vue de chaque acteur.`,
    path: isLatest ? '/archives' : `/archives/${month}`,
    body: `<h1>Archives : ${esc(frMonth(month))}</h1>
<p class="lead">Chaque édition résume l'actualité mondiale en cinq ou six sujets, sans la simplifier.</p>
<div class="months">${months.map((m) => (m === month ? `<span>${esc(frMonth(m))}</span>` : `<a href="/archives/${m}">${esc(frMonth(m))}</a>`)).join('')}</div>
${days || '<p class="lead">Aucune édition ce mois-ci.</p>'}`,
  });
}

export function renderNotFound(): string {
  return page({
    title: 'Page introuvable | Avactu',
    description: "Cette page n'existe pas ou plus.",
    path: '/archives',
    noindex: true,
    body: `<h1>Page introuvable</h1><p class="lead">Cette édition n'existe pas. <a href="/archives">Voir toutes les archives</a> ou <a href="/">lire l'édition du jour</a>.</p>`,
  });
}

export function renderSitemap(dates: string[], months: string[]): string {
  const urls = [
    `<url><loc>${APP_URL}/</loc><changefreq>daily</changefreq></url>`,
    `<url><loc>${APP_URL}/archives</loc><changefreq>daily</changefreq></url>`,
    ...months.slice(1).map((m) => `<url><loc>${APP_URL}/archives/${m}</loc></url>`),
    ...dates.map((d) => `<url><loc>${APP_URL}/edition/${d}</loc><lastmod>${d}</lastmod></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) || '';

function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('archive: SUPABASE_URL ou SUPABASE_SERVICE_KEY manquante');
    return res.status(500).send('Server configuration error');
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  const view = one(req.query.view);

  const html = (status: number, body: string, cache = CACHE) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', status === 200 ? cache : 'public, max-age=0, s-maxage=60');
    return res.status(status).send(body);
  };

  try {
    // Dates des éditions non vides (sert à l'index, au sitemap et aux liens précédent/suivant)
    const listDates = async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('newsletter_editions')
        .select('edition_date, first:stories_json->0->>id')
        .order('edition_date', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as unknown as { edition_date: string; first: string | null }[])
        .filter((r) => r.first)
        .map((r) => r.edition_date);
    };

    if (view === 'sitemap') {
      const dates = await listDates();
      if (dates.length === 0) return res.status(503).send('No editions');
      const months = monthsBetween(dates[0].slice(0, 7), dates[dates.length - 1].slice(0, 7));
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', CACHE);
      return res.status(200).send(renderSitemap(dates, months));
    }

    if (view === 'index') {
      const dates = await listDates();
      if (dates.length === 0) return html(404, renderNotFound());
      const months = monthsBetween(dates[0].slice(0, 7), dates[dates.length - 1].slice(0, 7));
      const month = one(req.query.month) || months[0];
      if (!/^\d{4}-\d{2}$/.test(month) || !months.includes(month)) return html(404, renderNotFound());
      const { data, error } = await supabase
        .from('newsletter_editions')
        .select('edition_date, stories_json')
        .gte('edition_date', `${month}-01`)
        .lt('edition_date', nextMonthStart(month))
        .order('edition_date', { ascending: false });
      if (error) throw new Error(error.message);
      return html(200, renderIndex(month, months, (data || []) as EditionRow[]));
    }

    if (view === 'edition' || view === 'story') {
      const id = one(req.query.id);
      const date = view === 'edition' ? one(req.query.date) : id.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (view === 'story' && !/^\d{4}-\d{2}-\d{2}-\d{1,3}$/.test(id))) {
        return html(404, renderNotFound());
      }
      const { data, error } = await supabase
        .from('newsletter_editions')
        .select('edition_date, stories_json')
        .eq('edition_date', date)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const stories = ((data as EditionRow | null)?.stories_json || []) as Story[];
      if (stories.length === 0) return html(404, renderNotFound());

      if (view === 'story') {
        const story = stories.find((s) => s.id === id);
        if (!story) return html(404, renderNotFound());
        return html(200, renderStory(date, story, stories.filter((s) => s.id !== id)));
      }

      const dates = await listDates();
      const i = dates.indexOf(date);
      return html(200, renderEdition(date, stories, i > 0 ? dates[i - 1] : null, i >= 0 && i < dates.length - 1 ? dates[i + 1] : null));
    }

    return html(404, renderNotFound());
  } catch (err) {
    console.error('archive error:', err instanceof Error ? err.message : err);
    return res.status(500).send('Erreur serveur');
  }
}
