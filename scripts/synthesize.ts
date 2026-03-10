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
  category: 'geopolitique' | 'economie' | 'politique';
  publishedAt: string;
  fetchedAt: string;
}

interface ArticleCluster {
  id: string;
  topic: string;
  category: 'geopolitique' | 'economie' | 'politique';
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
  category: 'geopolitique' | 'economie' | 'politique';
  _clusterCategory?: 'geopolitique' | 'economie' | 'politique';
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
const SYSTEM_PROMPT = `Tu es un analyste géopolitique senior. Tu reçois plusieurs articles de presse sur un même sujet provenant de sources différentes.

Ta mission : produire UNE synthèse qui croise ces sources de manière neutre et analytique.

FILTRAGE DE PERTINENCE (CRITIQUE) :
Avant de synthétiser, évalue si le sujet relève RÉELLEMENT de l'une des 3 catégories ci-dessous.

Définitions strictes des catégories :
- "geopolitique" : Relations entre ÉTATS ou blocs (diplomatie, conflits armés internationaux, sanctions, alliances, traités, tensions territoriales entre pays). Implique au moins 2 acteurs étatiques.
- "economie" : Macro-économie, marchés financiers, politique monétaire, commerce international, énergie, tech à impact systémique.
- "politique" : Politique intérieure d'un pays à portée structurelle (élections, réformes majeures, mouvements sociaux d'ampleur nationale).

SUJETS HORS SCOPE — réponds "hors_sujet" si le sujet est :
- Faits divers (fusillades, meurtres, accidents, crimes) même spectaculaires, SAUF s'ils déclenchent une crise diplomatique entre États
- Science, nature, environnement, biodiversité (migrations animales, découvertes scientifiques, météo) SAUF s'ils sont directement liés à une négociation ou un conflit entre États
- Sport, divertissement, célébrités
- Catastrophes naturelles SAUF si elles provoquent une crise politique/diplomatique avérée

En cas de doute : si le sujet n'implique pas de relations entre États ou d'enjeu macro-économique/politique structurel, c'est "hors_sujet".

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
  "category": "geopolitique" | "economie" | "politique",
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
  console.log(`📚 ${clusteredData.clusterCount} clusters chargés\n`);

  // Initialize Anthropic client
  const client = new Anthropic();

  // Synthesize stories
  const stories: Story[] = [];

  for (let i = 0; i < clusteredData.clusters.length; i++) {
    const cluster = clusteredData.clusters[i];
    const sourcesList = [...new Set(cluster.articles.map((a) => a.source))].join(', ');

    console.log(`📝 Synthèse ${i + 1}/${clusteredData.clusters.length}: ${cluster.topic}`);
    console.log(`   Sources: ${sourcesList} (${cluster.articles.length} articles)`);

    const story = await synthesizeStory(client, cluster, i);
    if (story) {
      stories.push(story);
      console.log(`   ✓ "${story.title}" → ${story.sources.length} sources`);
    }

    // Rate limiting
    if (i < clusteredData.clusters.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Enforce: geopolitique must be the most represented category
  // If Claude reclassified too many geo stories, revert them to cluster category
  const countByCategory = (s: Story[]) => s.reduce((acc, st) => {
    acc[st.category] = (acc[st.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let cats = countByCategory(stories);
  const geoCount = cats.geopolitique || 0;
  const maxOther = Math.max(cats.economie || 0, cats.politique || 0);

  if (geoCount <= maxOther) {
    console.log(`\n⚠ Géopolitique (${geoCount}) n'est pas la catégorie dominante — correction...`);
    // Revert reclassified stories (geo cluster → non-geo by Claude) back to geopolitique
    for (const story of stories) {
      if (story._clusterCategory === 'geopolitique' && story.category !== 'geopolitique') {
        console.log(`   ↩ "${story.title}" : ${story.category} → geopolitique`);
        story.category = 'geopolitique';
      }
    }
    cats = countByCategory(stories);
    console.log(`   → Géopolitique: ${cats.geopolitique || 0}, Économie: ${cats.economie || 0}, Politique: ${cats.politique || 0}`);
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
  console.log(`  • Économie: ${byCategory.economie || 0}`);
  console.log(`  • Politique: ${byCategory.politique || 0}`);

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
