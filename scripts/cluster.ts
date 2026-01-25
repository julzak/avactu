/**
 * Clustering Script - Regroupe les articles par sujet similaire via Claude
 *
 * Usage: npm run cluster
 *
 * Prérequis:
 *   - ANTHROPIC_API_KEY dans les variables d'environnement
 *   - data/raw-articles.json généré par npm run curate
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

interface RawArticlesInput {
  generatedAt: string;
  articleCount: number;
  articles: RawArticle[];
}

interface ArticleCluster {
  id: string;
  topic: string;
  category: 'geopolitique' | 'economie' | 'politique';
  importance: number; // 1-10
  articles: RawArticle[];
}

interface ClusteredOutput {
  generatedAt: string;
  clusterCount: number;
  clusters: ArticleCluster[];
}

// Constants
const RAW_ARTICLES_PATH = join(__dirname, '..', 'data', 'raw-articles.json');
const CLUSTERED_PATH = join(__dirname, '..', 'data', 'clustered-articles.json');

// Target: 4 géopo, 1 éco, 1 politique = 6 stories
const TARGET_CLUSTERS = {
  geopolitique: 4,
  economie: 1,
  politique: 1,
};

const SYSTEM_PROMPT = `Tu es un éditeur de presse expérimenté. Tu dois analyser une liste d'articles et les regrouper par SUJET/ÉVÉNEMENT similaire.

OBJECTIF :
- Identifier les articles qui parlent du MÊME événement ou sujet
- Créer des clusters cohérents (2-5 articles par cluster idéalement)
- Évaluer l'importance de chaque cluster (1-10)

RÈGLES :
1. Deux articles sur "bombardements en Ukraine" = même cluster
2. Un article sur "Ukraine" et un sur "Gaza" = clusters différents
3. Garde les articles isolés en cluster solo si pas de match
4. L'importance dépend de : impact mondial, actualité chaude, enjeux économiques

FORMAT DE SORTIE (JSON strict) :
{
  "clusters": [
    {
      "topic": "Description courte du sujet (10-15 mots max)",
      "category": "geopolitique" | "economie" | "politique",
      "importance": 8,
      "articleIds": ["id1", "id2", "id3"]
    }
  ]
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

/**
 * Cluster articles using Claude
 */
async function clusterArticles(
  client: Anthropic,
  articles: RawArticle[]
): Promise<ArticleCluster[]> {
  // Prepare articles summary for Claude
  const articlesSummary = articles.map((a, index) => ({
    id: a.id,
    index,
    title: a.title,
    description: a.description.slice(0, 200),
    source: a.source,
    category: a.category,
  }));

  const userPrompt = `Analyse ces ${articles.length} articles et regroupe-les par sujet similaire.

ARTICLES :
${JSON.stringify(articlesSummary, null, 2)}

Crée des clusters en regroupant les articles qui traitent du même événement ou sujet.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system: SYSTEM_PROMPT,
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

    const result = JSON.parse(jsonText);

    // Map article IDs back to full articles
    const articlesById = new Map(articles.map((a) => [a.id, a]));

    const clusters: ArticleCluster[] = result.clusters.map(
      (c: { topic: string; category: string; importance: number; articleIds: string[] }, index: number) => {
        const clusterArticles = c.articleIds
          .map((id: string) => articlesById.get(id))
          .filter((a): a is RawArticle => a !== undefined);

        return {
          id: `cluster-${index + 1}`,
          topic: c.topic,
          category: c.category as 'geopolitique' | 'economie' | 'politique',
          importance: c.importance,
          articles: clusterArticles,
        };
      }
    );

    return clusters;
  } catch (error) {
    console.error('❌ Erreur clustering:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Select best clusters based on category ratio and importance
 */
function selectBestClusters(clusters: ArticleCluster[]): ArticleCluster[] {
  const selected: ArticleCluster[] = [];

  // Sort by importance within each category
  const byCategory = {
    geopolitique: clusters
      .filter((c) => c.category === 'geopolitique')
      .sort((a, b) => b.importance - a.importance),
    economie: clusters
      .filter((c) => c.category === 'economie')
      .sort((a, b) => b.importance - a.importance),
    politique: clusters
      .filter((c) => c.category === 'politique')
      .sort((a, b) => b.importance - a.importance),
  };

  // Select based on target ratio
  for (const [category, target] of Object.entries(TARGET_CLUSTERS)) {
    const available = byCategory[category as keyof typeof byCategory];
    selected.push(...available.slice(0, target));
  }

  // Sort final selection by importance
  return selected.sort((a, b) => b.importance - a.importance);
}

/**
 * Main clustering function
 */
async function cluster(): Promise<void> {
  console.log('🔗 AVACTU - Script de clustering');
  console.log('=================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Erreur: ANTHROPIC_API_KEY non définie');
    process.exit(1);
  }

  // Load raw articles
  if (!existsSync(RAW_ARTICLES_PATH)) {
    console.error('❌ Erreur: raw-articles.json non trouvé');
    console.error("   Exécutez d'abord: npm run curate");
    process.exit(1);
  }

  const rawData: RawArticlesInput = JSON.parse(readFileSync(RAW_ARTICLES_PATH, 'utf-8'));
  console.log(`📚 ${rawData.articleCount} articles bruts chargés\n`);

  // Initialize Anthropic client
  const client = new Anthropic();

  // Cluster articles
  console.log('🤖 Analyse des articles par Claude...');
  const allClusters = await clusterArticles(client, rawData.articles);
  console.log(`   → ${allClusters.length} clusters identifiés\n`);

  // Log all clusters
  console.log('📊 Tous les clusters :');
  for (const cluster of allClusters) {
    console.log(
      `   [${cluster.category.slice(0, 4).toUpperCase()}] (${cluster.importance}/10) ${cluster.topic}`
    );
    console.log(`      → ${cluster.articles.length} articles: ${cluster.articles.map((a) => a.source).join(', ')}`);
  }

  // Select best clusters
  const selectedClusters = selectBestClusters(allClusters);
  console.log(`\n🎯 ${selectedClusters.length} clusters sélectionnés pour synthèse`);

  // Prepare output
  const output: ClusteredOutput = {
    generatedAt: new Date().toISOString(),
    clusterCount: selectedClusters.length,
    clusters: selectedClusters,
  };

  // Ensure data directory exists
  const dataDir = dirname(CLUSTERED_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Write output
  writeFileSync(CLUSTERED_PATH, JSON.stringify(output, null, 2), 'utf-8');

  // Summary
  console.log('\n=================================');
  console.log('📊 RÉSUMÉ');
  console.log('=================================');

  const byCategory = selectedClusters.reduce(
    (acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`Clusters sélectionnés: ${selectedClusters.length}`);
  console.log(`\nPar catégorie:`);
  console.log(`  • Géopolitique: ${byCategory.geopolitique || 0}`);
  console.log(`  • Économie: ${byCategory.economie || 0}`);
  console.log(`  • Politique: ${byCategory.politique || 0}`);

  const totalArticles = selectedClusters.reduce((sum, c) => sum + c.articles.length, 0);
  console.log(`\nTotal articles dans les clusters: ${totalArticles}`);

  console.log(`\n✅ Sauvegardé dans: ${CLUSTERED_PATH}`);
}

// Run
cluster().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
