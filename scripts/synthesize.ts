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

RÈGLES DE FRANÇAIS (TITRE ET BULLETS) :
- Toujours utiliser les articles devant les noms qui le nécessitent
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
  "execSummary": "4 paragraphes structurés (250-300 mots total) : Faits | Position A | Position B | Enjeux"
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
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [
        {
          type: 'text' as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

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

    // Find best image: prefer article whose title is most relevant to the synthesized story
    // Filter out logos, placeholders, and generic images
    const articlesWithValidImage = cluster.articles
      .filter((a) => a.imageUrl && isValidEditorialImage(a.imageUrl))
      .map((a) => ({
        ...a,
        relevance: titleSimilarity(storyData.title, a.title),
      }))
      .sort((a, b) => {
        // Primary: relevance to synthesized title; secondary: recency
        if (Math.abs(a.relevance - b.relevance) > 0.1) return b.relevance - a.relevance;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

    if (articlesWithValidImage.length === 0) {
      const rejectedImages = cluster.articles.filter((a) => a.imageUrl && !isValidEditorialImage(a.imageUrl));
      if (rejectedImages.length > 0) {
        console.warn(`   ⚠ ${rejectedImages.length} image(s) rejetée(s) (logo/placeholder) — fallback Unsplash`);
      }
    }

    const imageUrl =
      articlesWithValidImage[0]?.imageUrl ||
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';

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

Ta mission : identifier LE sujet le plus important/couvert par ces articles, puis produire UNE synthèse multi-sources sur ce sujet.

ÉTAPES :
1. Lis tous les articles
2. Identifie le sujet qui apparaît dans le PLUS de sources différentes
3. Ignore les articles qui ne traitent pas de ce sujet
4. Synthétise uniquement les articles pertinents

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

RÈGLES DE FRANÇAIS :
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
  "usedSources": ["Source 1", "Source 2"]
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
  category: 'tech' | 'eco',
  storyIndex: number
): Promise<Story | null> {
  const articlesDetail = articles
    .map(
      (a, i) => `
ARTICLE ${i + 1} (${a.source}) :
Titre: ${a.title}
Description: ${a.description}
URL: ${a.url}
`
    )
    .join('\n---\n');

  const sources = [...new Set(articles.map((a) => a.source))];
  const prompt = POOL_SYSTEM_PROMPT.replace(/%CATEGORY%/g, category);

  const userPrompt = `Voici ${articles.length} articles de la catégorie "${category}" provenant de ${sources.length} sources (${sources.join(', ')}).

Identifie le sujet le plus important couvert par PLUSIEURS sources et synthétise-le.

${articlesDetail}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [
        {
          type: 'text' as const,
          text: prompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

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

    const today = new Date().toISOString().split('T')[0];
    const id = `${today}-${String(storyIndex + 1).padStart(2, '0')}`;

    // Use sources from Claude's response if available, otherwise all sources
    const usedSources = storyData.usedSources || sources;

    // Find best image from articles matching the selected topic
    const articlesWithValidImage = articles
      .filter((a) => a.imageUrl && isValidEditorialImage(a.imageUrl))
      .map((a) => ({
        ...a,
        relevance: titleSimilarity(storyData.title, a.title),
      }))
      .sort((a, b) => {
        if (Math.abs(a.relevance - b.relevance) > 0.1) return b.relevance - a.relevance;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

    const imageUrl =
      articlesWithValidImage[0]?.imageUrl ||
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';

    const mostRecent = articles.reduce((latest, article) => {
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

  // Synthesize stories
  const stories: Story[] = [];
  let storyIndex = 0;

  // 1. Synthesize géopo clusters (traditional clustering)
  const geopoClusters = clusteredData.clusters.filter(c => c.category === 'geopolitique');
  console.log(`\n🌍 Géopolitique: ${geopoClusters.length} clusters`);

  for (const cluster of geopoClusters) {
    if (stories.filter(s => s.category === 'geopolitique').length >= 3) break;
    const sourcesList = [...new Set(cluster.articles.map((a) => a.source))].join(', ');
    console.log(`📝 Synthèse géopo ${storyIndex + 1}: ${cluster.topic.slice(0, 60)}`);
    console.log(`   Sources: ${sourcesList} (${cluster.articles.length} articles)`);

    const story = await synthesizeStory(client, cluster, storyIndex);
    if (story) {
      stories.push(story);
      console.log(`   ✓ "${story.title}" → ${story.sources.length} sources`);
      storyIndex++;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // If géopo clusters didn't produce enough stories, use pool-based fallback
  const geopoCount = stories.filter(s => s.category === 'geopolitique').length;
  if (geopoCount < 3) {
    const geopoArticles = rawArticles.filter((a: RawArticle) => a.category === 'geopolitique');
    const needed = 3 - geopoCount;
    console.log(`\n🌍 Géopo fallback: ${needed} story(ies) manquante(s), pool de ${geopoArticles.length} articles`);

    // Sort by recency, take top 40 most recent
    const recentGeopo = geopoArticles
      .sort((a: RawArticle, b: RawArticle) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 40);

    // Collect already-covered topics to exclude
    const coveredTopics = stories.map(s => s.title).join(', ');

    const geopoPoolPrompt = POOL_SYSTEM_PROMPT
      .replace(/%CATEGORY%/g, 'geopolitique')
      + (coveredTopics ? `\n\nSUJETS DÉJÀ COUVERTS (ne PAS les reprendre) : ${coveredTopics}` : '');

    for (let i = 0; i < needed; i++) {
      const excludeTopics = stories.filter(s => s.category === 'geopolitique').map(s => s.title);
      const excludeStr = excludeTopics.length > 0
        ? `\n\nATTENTION — SUJETS DÉJÀ COUVERTS (tu DOIS choisir un sujet COMPLÈTEMENT DIFFÉRENT, pas une variante du même conflit/événement) :\n${excludeTopics.map(t => `- ${t}`).join('\n')}`
        : '';

      const articlesDetail = recentGeopo
        .map((a: RawArticle, idx: number) => `ARTICLE ${idx + 1} (${a.source}) :\nTitre: ${a.title}\nDescription: ${a.description}\nURL: ${a.url}`)
        .join('\n---\n');

      const sources = [...new Set(recentGeopo.map((a: RawArticle) => a.source))];

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: [{ type: 'text' as const, text: geopoPoolPrompt, cache_control: { type: 'ephemeral' as const } }],
          messages: [{ role: 'user', content: `Voici ${recentGeopo.length} articles géopolitiques de ${sources.length} sources.
Identifie le sujet le plus important couvert par PLUSIEURS sources et synthétise-le.${excludeStr}

${articlesDetail}` }],
        });

        const content = response.content[0];
        if (content.type !== 'text') continue;

        let jsonText = content.text.trim();
        if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
        else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
        if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
        jsonText = jsonText.trim();

        const storyData = JSON.parse(jsonText);
        if (storyData.category === 'hors_sujet') {
          console.log(`   ⊘ Rejeté: ${storyData.reason || 'hors scope'}`);
          continue;
        }

        const today = new Date().toISOString().split('T')[0];
        const id = `${today}-${String(storyIndex + 1).padStart(2, '0')}`;
        const usedSources = storyData.usedSources || sources;

        const articlesWithValidImage = recentGeopo
          .filter((a: RawArticle) => a.imageUrl && isValidEditorialImage(a.imageUrl))
          .map((a: RawArticle) => ({ ...a, relevance: titleSimilarity(storyData.title, a.title) }))
          .sort((a: { relevance: number; publishedAt: string }, b: { relevance: number; publishedAt: string }) => {
            if (Math.abs(a.relevance - b.relevance) > 0.1) return b.relevance - a.relevance;
            return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          });

        const imageUrl = articlesWithValidImage[0]?.imageUrl || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800';
        const mostRecent = recentGeopo.reduce((latest: RawArticle, article: RawArticle) =>
          new Date(article.publishedAt) > new Date(latest.publishedAt) ? article : latest
        );

        const story: Story = {
          id,
          category: 'geopolitique',
          title: storyData.title,
          imageUrl,
          location: storyData.location,
          bullets: storyData.bullets,
          execSummary: storyData.execSummary,
          sources: usedSources,
          publishedAt: mostRecent.publishedAt,
        };

        stories.push(story);
        console.log(`   ✓ "${story.title}" → ${story.sources.length} sources`);
        storyIndex++;
      } catch (error) {
        console.error(`   ✗ Erreur: ${error instanceof Error ? error.message : error}`);
      }

      if (i < needed - 1) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // 2. Synthesize tech from full article pool
  const techArticles = rawArticles.filter(a => a.category === 'tech');
  console.log(`\n💻 Tech: ${techArticles.length} articles dans le pool`);
  if (techArticles.length > 0) {
    const techStory = await synthesizeFromPool(client, techArticles, 'tech', storyIndex);
    if (techStory) {
      stories.push(techStory);
      console.log(`   ✓ "${techStory.title}" → ${techStory.sources.length} sources`);
      storyIndex++;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // 3. Synthesize eco from full article pool
  const ecoArticles = rawArticles.filter(a => a.category === 'eco');
  console.log(`\n💰 Éco: ${ecoArticles.length} articles dans le pool`);
  if (ecoArticles.length > 0) {
    const ecoStory = await synthesizeFromPool(client, ecoArticles, 'eco', storyIndex);
    if (ecoStory) {
      stories.push(ecoStory);
      console.log(`   ✓ "${ecoStory.title}" → ${ecoStory.sources.length} sources`);
      storyIndex++;
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
