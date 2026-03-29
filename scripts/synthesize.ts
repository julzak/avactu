/**
 * Synthesis Script - Génère les stories multi-sources via Claude API
 *
 * Usage: npm run synthesize
 *
 * Prérequis:
 *   - ANTHROPIC_API_KEY dans les variables d'environnement
 *   - data/clustered-articles.json généré par npm run cluster
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isValidEditorialImage } from './image-validation.js';
import { createClient } from '@supabase/supabase-js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface RawArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: string;
  category: 'geopolitique' | 'tech' | 'eco';
  publishedAt: string;
  fetchedAt: string;
}

interface ArticleCluster {
  id: string;
  topic: string;
  category: 'geopolitique' | 'tech' | 'eco';
  importance: number;
  articles: RawArticle[];
}

interface ClusteredInput {
  generatedAt: string;
  clusterCount: number;
  clusters: ArticleCluster[];
}

interface Location {
  lat: number;
  lng: number;
  name: string;
}

interface Story {
  id: string;
  category: 'geopolitique' | 'tech' | 'eco';
  _clusterCategory?: 'geopolitique' | 'tech' | 'eco';
  title: string;
  imageUrl: string;
  location: Location;
  bullets: string[];
  execSummary: string;
  sources: string[];
  publishedAt: string;
}

interface Edition {
  date: string;
  stories: Story[];
}

// Constants
const CLUSTERED_PATH = join(__dirname, '..', 'data', 'clustered-articles.json');
const STORIES_PATH = join(__dirname, '..', 'public', 'data', 'stories.json');

/**
 * Fetch recent story titles by category from newsletter_editions (last N days)
 */
async function fetchRecentStoryTitles(category: string, days = 7): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('newsletter_editions')
      .select('stories_json')
      .gte('edition_date', since)
      .order('edition_date', { ascending: false });

    if (error || !data) return [];

    const titles: string[] = [];
    for (const edition of data) {
      const stories = edition.stories_json;
      if (Array.isArray(stories)) {
        for (const s of stories) {
          if (s.category === category) titles.push(s.title);
        }
      }
    }
    return titles;
  } catch {
    return [];
  }
}

/**
 * Simple word-overlap similarity between two titles (0-1)
 * Used to pick the most relevant image for a synthesized story
 */
function titleSimilarity(title1: string, title2: string): number {
  const normalize = (t: string) =>
    t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const words1 = new Set(normalize(title1));
  const words2 = new Set(normalize(title2));
  if (words1.size === 0 || words2.size === 0) return 0;
  const intersection = [...words1].filter(w => words2.has(w)).length;
  return intersection / Math.max(words1.size, words2.size);
}

/**
 * Retry wrapper for Claude API calls with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 2, baseDelay = 2000, label = 'API call' } = {}
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error && (
        error.message.includes('rate_limit') ||
        error.message.includes('429') ||
        error.message.includes('overloaded')
      );
      if (attempt < maxRetries && (isRateLimit || (error instanceof Error && error.message.includes('timeout')))) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`   ⚠ ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`${label} failed after ${maxRetries + 1} attempts`);
}

// System prompt pour synthèse multi-sources
const SYSTEM_PROMPT = `Tu es un analyste senior. Tu reçois plusieurs articles de presse sur un même sujet provenant de sources différentes.

Ta mission : produire UNE synthèse qui croise ces sources de manière neutre et analytique. Le public cible a entre 15 et 22 ans — ne simplifie pas, mais rends le sujet captivant et pertinent.

FILTRAGE DE PERTINENCE (CRITIQUE) :
Avant de synthétiser, évalue si le sujet relève RÉELLEMENT de l'une des 2 catégories ci-dessous.

Définitions des catégories :
- "geopolitique" : Politique et relations internationales OU événements politiques nationaux MAJEURS (élections, résultats électoraux, changements de gouvernement). Les élections municipales/présidentielles/législatives sont TOUJOURS pertinentes.
- "tech" : Technologie, IA, espace, science, innovation, culture numérique, cybersécurité, réseaux sociaux, startups tech, cinéma/culture quand l'angle est tech ou phénomène de société (ex: Oscars, IA à Hollywood).
- "eco" : Économie, business, marchés, entreprises, emploi, énergie, industrie à portée nationale ou internationale.

SUJETS HORS SCOPE — réponds "hors_sujet" UNIQUEMENT si :
- Sport pur (résultats de matchs, transferts, compétitions sportives)
- Faits divers locaux sans portée nationale
- People/célébrités sans dimension politique, tech ou économique

IMPORTANT : Les événements suivants ne sont JAMAIS hors sujet :
- Élections (municipales, présidentielles, législatives) dans tout pays
- Cérémonies culturelles majeures (Oscars, Cannes, etc.) → catégorie "tech"
- Manifestations, mouvements sociaux → catégorie "geopolitique"

En cas de doute : le sujet doit être quelque chose qu'un ado curieux partagerait avec ses amis. Garde-le.

RÈGLES DE NEUTRALITÉ ABSOLUE :
1. Cite au moins 2-3 sources différentes quand disponibles
2. Dans les bullets, présente les FAITS uniquement (pas d'opinion, pas de jugement)
3. Si les sources se contredisent, mentionne-le : "Selon X... tandis que Y affirme..."
4. Ne prends JAMAIS parti pour un acteur contre un autre

STRUCTURE OBLIGATOIRE DE L'EXEC SUMMARY (4 paragraphes) :
- Paragraphe 1 : LES FAITS — Ce qui s'est passé, quand, où, qui est impliqué (factuel, indiscutable)
- Paragraphe 2 : POSITION A — Comment l'acteur principal justifie son action, ses arguments, sa logique
- Paragraphe 3 : POSITION B — Comment l'adversaire/opposant/critique perçoit la situation, ses contre-arguments
- Paragraphe 4 : ENJEUX — Conséquences économiques, stratégiques, et perspectives futures

RÈGLES DE FRANÇAIS (TITRE ET BULLETS) — CRITIQUE :
- Chaque bullet DOIT être une phrase française grammaticalement correcte
- Chaque bullet DOIT commencer par un article ou déterminant (Le, La, Les, L', Un, Une, Des, De)
- JAMAIS de bullet commençant directement par un nom commun sans article : "Faux médias..." → "De faux médias...", "Objectif :" → "L'objectif :", "Comptes inauthentiques..." → "Des comptes inauthentiques...", "Menace la stabilité" → "Une menace pour la stabilité"
- Articles devant les noms de pays : la Russie, la France, la Chine, les États-Unis, le Royaume-Uni, l'Ukraine, l'Iran
- Articles devant les lieux : le Groenland, la Crimée, le Moyen-Orient
- Articles devant les groupes/institutions : les dirigeants, les analystes, l'armée, le gouvernement
- Forme correcte : "La Russie bombarde Kiev" PAS "Russie bombarde Kiev"
- IMPORTANT : N'écris PAS les articles en majuscules (pas "LA Russie" mais "La Russie" ou "la Russie")

FORMAT DE SORTIE (JSON strict, pas de markdown) :

Si le sujet est pertinent :
{
  "category": "geopolitique" | "tech" | "eco",
  "title": "Titre factuel avec articles corrects (max 60 caractères)",
  "location": {
    "lat": <latitude>,
    "lng": <longitude>,
    "name": "Nom du lieu principal (pour les villes françaises, ajouter ', France' : ex: 'Échirolles, France')"
  },
  "bullets": [
    "Le fait principal — qui fait quoi, où (max 15 mots)",
    "Le déclencheur — pourquoi maintenant (max 15 mots)",
    "La position/réaction de l'acteur A (max 15 mots)",
    "La position/réaction de l'acteur B ou opposant (max 15 mots)",
    "L'enjeu économique ou stratégique clé (max 15 mots)"
  ],
  "execSummary": "4 paragraphes structurés (250-300 mots total) : Faits | Position A | Position B | Enjeux",
  "bestImageArticle": <numéro de l'article (1-based) dont l'image illustre le MIEUX cette story — choisis l'article dont le SUJET VISUEL correspond le mieux au fait principal, PAS un article sur un sujet connexe mais différent>
}

Si le sujet est HORS SCOPE :
{
  "category": "hors_sujet",
  "reason": "Explication courte (ex: 'Fait divers sans dimension diplomatique', 'Sujet scientifique/nature')"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

/**
 * Synthesize a story from a cluster of articles
 */
async function synthesizeStory(
  client: Anthropic,
  cluster: ArticleCluster,
  storyIndex: number
): Promise<Story | null> {
  // Build detailed prompt with all articles
  const articlesDetail = cluster.articles
    .map(
      (a, i) => `
ARTICLE ${i + 1} (${a.source}) :
Titre: ${a.title}
Description: ${a.description}
URL: ${a.url}
`
    )
    .join('\n---\n');

  const userPrompt = `Synthétise ces ${cluster.articles.length} articles sur le sujet "${cluster.topic}" en UNE story pour Avactu.

SOURCES DISPONIBLES :
${[...new Set(cluster.articles.map((a) => a.source))].join(', ')}

${articlesDetail}

Génère la story au format JSON demandé. Assure-toi de croiser les perspectives des différentes sources.`;

  try {
    const response = await withRetry(
      () => client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: [
          {
            type: 'text' as const,
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
      { label: `synthesize cluster "${cluster.topic.slice(0, 30)}"` }
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Clean markdown code fences if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    // Parse JSON response
    const storyData = JSON.parse(jsonText);

    // Filter out irrelevant stories
    if (storyData.category === 'hors_sujet') {
      console.log(`   ⊘ Rejeté (hors scope): ${storyData.reason || 'pas de raison'}`);
      return null;
    }

    // Generate story ID
    const today = new Date().toISOString().split('T')[0];
    const id = `${today}-${String(storyIndex + 1).padStart(2, '0')}`;

    // Get all unique sources
    const allSources = [...new Set(cluster.articles.map((a) => a.source))];

    // Find best image: use Claude's choice (bestImageArticle) with validation fallback
    let imageUrl = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';

    // Claude picks the best article for the image (1-based index)
    const pickedIndex = storyData.bestImageArticle;
    if (pickedIndex && pickedIndex >= 1 && pickedIndex <= cluster.articles.length) {
      const picked = cluster.articles[pickedIndex - 1];
      if (picked.imageUrl && isValidEditorialImage(picked.imageUrl)) {
        imageUrl = picked.imageUrl;
      } else {
        console.warn(`   ⚠ Image choisie par Claude (article ${pickedIndex}) rejetée par validation`);
      }
    }

    // Fallback: if Claude's pick was invalid, try other articles sorted by recency
    if (imageUrl.includes('unsplash.com')) {
      const fallback = cluster.articles
        .filter((a) => a.imageUrl && isValidEditorialImage(a.imageUrl))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      if (fallback.length > 0) {
        imageUrl = fallback[0].imageUrl!;
        console.warn(`   ⚠ Fallback image: article le plus récent avec image valide`);
      } else {
        console.warn(`   ⚠ Aucune image valide — fallback Unsplash`);
      }
    }

    // Get most recent publishedAt
    const mostRecent = cluster.articles.reduce((latest, article) => {
      return new Date(article.publishedAt) > new Date(latest.publishedAt) ? article : latest;
    });

    const story: Story = {
      id,
      category: storyData.category || cluster.category,
      _clusterCategory: cluster.category, // Keep original for post-synthesis enforcement
      title: storyData.title,
      imageUrl,
      location: storyData.location,
      bullets: storyData.bullets,
      execSummary: storyData.execSummary,
      sources: allSources,
      publishedAt: mostRecent.publishedAt,
    };

    return story;
  } catch (error) {
    console.error(`   ✗ Erreur synthèse: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

// System prompt for pool-based synthesis (tech/eco categories)
const POOL_SYSTEM_PROMPT = `Tu es un analyste senior. Tu reçois une liste d'articles de presse d'une même catégorie thématique.

Ta mission : identifier LE sujet le plus important parmi ces articles, puis produire UNE synthèse multi-sources sur ce sujet.

ÉTAPES :
1. Lis tous les articles
2. Identifie les sujets couverts par PLUSIEURS sources différentes
3. Parmi ces sujets, choisis celui qui est le plus important ET qui n'a PAS été couvert récemment (voir SUJETS INTERDITS ci-dessous si présent)
4. Ignore les articles qui ne traitent pas de ce sujet
5. Synthétise uniquement les articles pertinents

CATÉGORIE ATTENDUE : "%CATEGORY%"
Définitions :
- "geopolitique" : Politique et relations internationales OU événements politiques nationaux MAJEURS (élections, résultats électoraux, changements de gouvernement).
- "tech" : Technologie, IA, espace, science, innovation, culture numérique, cybersécurité, réseaux sociaux, startups tech, cinéma/culture quand l'angle est tech ou phénomène de société (ex: Oscars, IA à Hollywood).
- "eco" : Économie, business, marchés, entreprises, emploi, énergie, industrie à portée nationale ou internationale.

SUJETS HORS SCOPE — réponds "hors_sujet" UNIQUEMENT si AUCUN sujet pertinent n'émerge :
- Sport pur (résultats de matchs)
- Faits divers locaux sans portée nationale
- People/célébrités sans dimension politique, tech ou économique

RÈGLES DE NEUTRALITÉ ABSOLUE :
1. Cite au moins 2 sources différentes quand disponibles
2. Présente les FAITS uniquement dans les bullets
3. Si les sources se contredisent, mentionne-le

STRUCTURE OBLIGATOIRE DE L'EXEC SUMMARY (4 paragraphes) :
- Paragraphe 1 : LES FAITS — Ce qui s'est passé, quand, où
- Paragraphe 2 : CONTEXTE — Pourquoi c'est important
- Paragraphe 3 : RÉACTIONS — Comment les acteurs réagissent
- Paragraphe 4 : ENJEUX — Conséquences et perspectives

RÈGLES DE FRANÇAIS (CRITIQUE) :
- Chaque bullet DOIT être une phrase française grammaticalement correcte
- Chaque bullet DOIT commencer par un article ou déterminant (Le, La, Les, L', Un, Une, Des, De)
- JAMAIS de bullet commençant directement par un nom commun sans article : "Faux médias..." → "De faux médias...", "Objectif :" → "L'objectif :", "Comptes inauthentiques..." → "Des comptes inauthentiques..."
- Articles devant les noms de pays et institutions
- N'écris PAS les articles en majuscules

FORMAT DE SORTIE (JSON strict, pas de markdown) :

Si un sujet pertinent émerge :
{
  "category": "%CATEGORY%",
  "title": "Titre factuel (max 60 caractères)",
  "location": { "lat": <latitude>, "lng": <longitude>, "name": "Lieu principal" },
  "bullets": [
    "Le fait principal (max 15 mots)",
    "Le déclencheur (max 15 mots)",
    "Réaction/position A (max 15 mots)",
    "Réaction/position B (max 15 mots)",
    "L'enjeu clé (max 15 mots)"
  ],
  "execSummary": "4 paragraphes (250-300 mots)",
  "usedSources": ["Source 1", "Source 2"],
  "bestImageArticle": <numéro de l'article (1-based) dont l'image illustre le MIEUX cette story — choisis l'article dont le SUJET VISUEL correspond au fait principal>
}

Si aucun sujet pertinent :
{
  "category": "hors_sujet",
  "reason": "Explication courte"
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON.`;

/**
 * Synthesize a story from a pool of all articles in a category.
 * Claude picks the best topic covered by multiple sources.
 */
async function synthesizeFromPool(
  client: Anthropic,
  articles: RawArticle[],
  category: 'geopolitique' | 'tech' | 'eco',
  storyIndex: number,
  recentTitles: string[] = []
): Promise<Story | null> {
  let prompt = POOL_SYSTEM_PROMPT.replace(/%CATEGORY%/g, category);

  // Pre-filter: remove articles too similar to recent titles (upstream filtering)
  let filteredArticles = articles;
  if (recentTitles.length > 0) {
    const SIMILARITY_THRESHOLD = 0.35;
    filteredArticles = articles.filter(a => {
      const maxSim = Math.max(...recentTitles.map(t => titleSimilarity(a.title, t)));
      return maxSim < SIMILARITY_THRESHOLD;
    });
    const removed = articles.length - filteredArticles.length;
    if (removed > 0) {
      console.log(`   🔄 ${removed} articles filtrés (trop similaires aux titres récents)`);
    }
    // Fallback: if all articles filtered out, keep originals
    if (filteredArticles.length === 0) filteredArticles = articles;

    // Add hard constraint to prompt
    prompt += `\n\nSUJETS INTERDITS (déjà couverts ces derniers jours) :
Les sujets suivants ont DÉJÀ été traités. Tu ne DOIS PAS les couvrir à nouveau, même s'ils apparaissent dans beaucoup de sources.
Choisis un AUTRE sujet, même s'il est couvert par moins de sources.
Si tu produis un titre similaire à l'un de ceux-ci, ta réponse sera rejetée.
${recentTitles.map(t => `- "${t}"`).join('\n')}`;
  }

  const articlesDetail = filteredArticles
    .map(
      (a, i) => `
ARTICLE ${i + 1} (${a.source}) :
Titre: ${a.title}
Description: ${a.description}
URL: ${a.url}
`
    )
    .join('\n---\n');

  const filteredSources = [...new Set(filteredArticles.map((a) => a.source))];

  const userPrompt = `Voici ${filteredArticles.length} articles de la catégorie "${category}" provenant de ${filteredSources.length} sources (${filteredSources.join(', ')}).

Identifie le sujet le plus important qui N'A PAS été couvert récemment et synthétise-le.

${articlesDetail}`;

  try {
    const response = await withRetry(
      () => client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: [
          {
            type: 'text' as const,
            text: prompt,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
      { label: `synthesize pool ${category}` }
    );

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    const storyData = JSON.parse(jsonText);

    if (storyData.category === 'hors_sujet') {
      console.log(`   ⊘ Rejeté (hors scope): ${storyData.reason || 'pas de raison'}`);
      return null;
    }

    // Post-synthesis guard: reject if title too similar to recent titles
    if (recentTitles.length > 0) {
      const POST_SIMILARITY_THRESHOLD = 0.4;
      const maxSim = Math.max(...recentTitles.map(t => titleSimilarity(storyData.title, t)));
      if (maxSim >= POST_SIMILARITY_THRESHOLD) {
        const closest = recentTitles.reduce((best, t) =>
          titleSimilarity(storyData.title, t) > titleSimilarity(storyData.title, best) ? t : best
        );
        console.log(`   ⚠️  Titre trop similaire à "${closest}" (sim=${maxSim.toFixed(2)}), rejeté`);
        return null;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const id = `${today}-${String(storyIndex + 1).padStart(2, '0')}`;

    // Use sources from Claude's response if available, otherwise all sources
    const usedSources = storyData.usedSources || filteredSources;

    // Find best image: use Claude's choice (bestImageArticle) with validation fallback
    let imageUrl = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';

    // Claude picks the best article for the image (1-based index, refers to filteredArticles)
    const pickedIndex = storyData.bestImageArticle;
    if (pickedIndex && pickedIndex >= 1 && pickedIndex <= filteredArticles.length) {
      const picked = filteredArticles[pickedIndex - 1];
      if (picked.imageUrl && isValidEditorialImage(picked.imageUrl)) {
        imageUrl = picked.imageUrl;
      } else {
        console.warn(`   ⚠ Image choisie par Claude (article ${pickedIndex}) rejetée par validation`);
      }
    }

    // Fallback: if Claude's pick was invalid, try all articles sorted by recency
    if (imageUrl.includes('unsplash.com')) {
      const fallback = articles
        .filter((a) => a.imageUrl && isValidEditorialImage(a.imageUrl))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      if (fallback.length > 0) {
        imageUrl = fallback[0].imageUrl!;
        console.warn(`   ⚠ Fallback image: article le plus récent avec image valide`);
      } else {
        console.warn(`   ⚠ Aucune image valide — fallback Unsplash`);
      }
    }

    const mostRecent = filteredArticles.reduce((latest, article) => {
      return new Date(article.publishedAt) > new Date(latest.publishedAt) ? article : latest;
    });

    return {
      id,
      category,
      title: storyData.title,
      imageUrl,
      location: storyData.location,
      bullets: storyData.bullets,
      execSummary: storyData.execSummary,
      sources: usedSources,
      publishedAt: mostRecent.publishedAt,
    };
  } catch (error) {
    console.error(`   ✗ Erreur synthèse pool: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Main synthesis function
 */
async function synthesize(): Promise<void> {
  console.log('🧠 AVACTU - Script de synthèse multi-sources');
  console.log('=============================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Erreur: ANTHROPIC_API_KEY non définie');
    console.error('   Export la variable: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  // Load clustered articles
  if (!existsSync(CLUSTERED_PATH)) {
    console.error('❌ Erreur: clustered-articles.json non trouvé');
    console.error("   Exécutez d'abord: npm run cluster");
    process.exit(1);
  }

  const clusteredData: ClusteredInput = JSON.parse(readFileSync(CLUSTERED_PATH, 'utf-8'));
  console.log(`📚 ${clusteredData.clusterCount} clusters chargés`);

  // Also load raw articles for pool-based synthesis (tech/eco)
  const RAW_ARTICLES_PATH = join(__dirname, '..', 'data', 'raw-articles.json');
  const rawData = JSON.parse(readFileSync(RAW_ARTICLES_PATH, 'utf-8'));
  const rawArticles: RawArticle[] = rawData.articles;

  // Initialize Anthropic client
  const client = new Anthropic();

  // Synthesize stories — flexible allocation, clusters drive the edition
  const stories: Story[] = [];
  const usedImageUrls = new Set<string>(); // Track used images to prevent duplicates
  let storyIndex = 0;

  const TARGET_STORIES = 5;

  // 1. Synthesize all clusters from cluster.ts (already ranked by importance, max 3/category)
  console.log(`\n📝 Synthèse de ${clusteredData.clusters.length} clusters...`);

  for (const cluster of clusteredData.clusters) {
    if (stories.length >= TARGET_STORIES) break;

    const sourcesList = [...new Set(cluster.articles.map((a) => a.source))].join(', ');
    console.log(`\n📝 Story ${storyIndex + 1} [${cluster.category}]: ${cluster.topic.slice(0, 60)}`);
    console.log(`   Sources: ${sourcesList} (${cluster.articles.length} articles)`);

    const story = await synthesizeStory(client, cluster, storyIndex);
    if (story) {
      // Deduplicate images: if this image was already used, try fallback
      if (usedImageUrls.has(story.imageUrl) && !story.imageUrl.includes('unsplash.com')) {
        console.warn(`   ⚠ Image déjà utilisée, recherche alternative...`);
        const altImage = cluster.articles
          .filter((a) => a.imageUrl && isValidEditorialImage(a.imageUrl) && !usedImageUrls.has(a.imageUrl!))
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        story.imageUrl = altImage[0]?.imageUrl || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';
      }
      usedImageUrls.add(story.imageUrl);
      stories.push(story);
      console.log(`   ✓ "${story.title}" → ${story.sources.length} sources`);
      storyIndex++;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // 2. If clusters didn't fill all slots, use pool-based synthesis for remaining
  if (stories.length < TARGET_STORIES) {
    // Identify which categories have room for more stories
    const categoriesWithArticles: ('geopolitique' | 'tech' | 'eco')[] = ['geopolitique', 'tech', 'eco'];

    for (const category of categoriesWithArticles) {
      if (stories.length >= TARGET_STORIES) break;

      const catArticles = rawArticles.filter((a: RawArticle) => a.category === category);
      if (catArticles.length === 0) continue;

      const recentTitles = await fetchRecentStoryTitles(category, 7);
      // Also exclude titles already in this edition
      const editionTitles = stories.map(s => s.title);
      const allExcludedTitles = [...recentTitles, ...editionTitles];

      console.log(`\n🔄 Pool fallback [${category}]: ${catArticles.length} articles`);

      const poolStory = await synthesizeFromPool(client, catArticles, category, storyIndex, allExcludedTitles);
      if (poolStory) {
        // Deduplicate images
        if (usedImageUrls.has(poolStory.imageUrl) && !poolStory.imageUrl.includes('unsplash.com')) {
          poolStory.imageUrl = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';
        }
        usedImageUrls.add(poolStory.imageUrl);
        stories.push(poolStory);
        console.log(`   ✓ "${poolStory.title}" → ${poolStory.sources.length} sources`);
        storyIndex++;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Enforce: revert reclassified stories back to their cluster category
  for (const story of stories) {
    if (story._clusterCategory && story.category !== story._clusterCategory) {
      console.log(`   ↩ "${story.title}" : ${story.category} → ${story._clusterCategory}`);
      story.category = story._clusterCategory;
    }
  }

  // Strip internal _clusterCategory before output
  const cleanStories = stories.map(({ _clusterCategory, ...rest }) => rest);

  // Create edition
  const edition: Edition = {
    date: new Date().toISOString(),
    stories: cleanStories,
  };

  // Write output
  writeFileSync(STORIES_PATH, JSON.stringify(edition, null, 2), 'utf-8');

  // Summary
  console.log('\n=============================================');
  console.log('📊 RÉSUMÉ');
  console.log('=============================================');
  console.log(`Stories générées: ${stories.length}`);

  const byCategory = stories.reduce(
    (acc, story) => {
      acc[story.category] = (acc[story.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`\nPar catégorie:`);
  console.log(`  • Géopolitique: ${byCategory.geopolitique || 0}`);
  console.log(`  • Tech: ${byCategory.tech || 0}`);
  console.log(`  • Éco: ${byCategory.eco || 0}`);

  // Sources stats
  const avgSources = stories.reduce((sum, s) => sum + s.sources.length, 0) / stories.length;
  console.log(`\nMoyenne sources par story: ${avgSources.toFixed(1)}`);

  console.log(`\n✅ Sauvegardé dans: ${STORIES_PATH}`);
}

// Run
synthesize().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
