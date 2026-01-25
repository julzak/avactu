/**
 * Clustering Script - Regroupe les articles par sujet similaire (algorithme local TF-IDF)
 *
 * Usage: npm run cluster
 *
 * Pas besoin d'API - clustering local ultra-rapide
 */

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
  importance: number;
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

// Similarity threshold for clustering
const SIMILARITY_THRESHOLD = 0.25;

// French stop words to ignore
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'en', 'au', 'aux',
  'à', 'ce', 'ces', 'cette', 'que', 'qui', 'quoi', 'dont', 'où', 'sur', 'sous',
  'par', 'pour', 'avec', 'sans', 'dans', 'est', 'sont', 'a', 'ont', 'être',
  'avoir', 'fait', 'faire', 'il', 'elle', 'ils', 'elles', 'nous', 'vous',
  'son', 'sa', 'ses', 'leur', 'leurs', 'plus', 'moins', 'très', 'aussi',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'as', 'after', 'before', 'when', 'where', 'how', 'why', 'what',
  'which', 'who', 'whom', 'whose', 'if', 'then', 'else', 'so', 'than', 'too',
  'very', 'just', 'only', 'also', 'not', 'no', 'yes', 'all', 'any', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'own',
]);

/**
 * Tokenize and clean text
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Build TF-IDF vectors for documents
 */
function buildTfIdf(documents: string[][]): Map<string, number>[] {
  // Calculate document frequency for each term
  const docFreq = new Map<string, number>();
  const numDocs = documents.length;

  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  // Build TF-IDF vector for each document
  return documents.map((doc) => {
    const termFreq = new Map<string, number>();
    for (const term of doc) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }

    const tfidf = new Map<string, number>();
    for (const [term, tf] of termFreq) {
      const df = docFreq.get(term) || 1;
      const idf = Math.log(numDocs / df);
      tfidf.set(term, tf * idf);
    }

    return tfidf;
  });
}

/**
 * Calculate cosine similarity between two TF-IDF vectors
 */
function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const [term, weight] of vec1) {
    norm1 += weight * weight;
    if (vec2.has(term)) {
      dotProduct += weight * vec2.get(term)!;
    }
  }

  for (const weight of vec2.values()) {
    norm2 += weight * weight;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Cluster articles using TF-IDF similarity
 */
function clusterArticles(articles: RawArticle[]): ArticleCluster[] {
  // Tokenize all articles
  const documents = articles.map((a) => tokenize(`${a.title} ${a.description}`));

  // Build TF-IDF vectors
  const vectors = buildTfIdf(documents);

  // Greedy clustering
  const clusters: ArticleCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (assigned.has(i)) continue;

    // Start a new cluster with this article
    const clusterArticles = [articles[i]];
    assigned.add(i);

    // Find similar articles
    for (let j = i + 1; j < articles.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = cosineSimilarity(vectors[i], vectors[j]);
      if (similarity >= SIMILARITY_THRESHOLD) {
        clusterArticles.push(articles[j]);
        assigned.add(j);
      }
    }

    // Create cluster
    const mainArticle = clusterArticles[0];
    const uniqueSources = new Set(clusterArticles.map((a) => a.source));

    // Calculate importance based on:
    // - Number of articles (more = more important)
    // - Number of unique sources (more = more important)
    // - Recency (newer = more important)
    const numArticles = clusterArticles.length;
    const numSources = uniqueSources.size;
    const recency = Math.max(
      ...clusterArticles.map((a) => new Date(a.publishedAt).getTime())
    );
    const hoursAgo = (Date.now() - recency) / (1000 * 60 * 60);

    let importance = Math.min(10, numArticles * 2 + numSources * 2);
    if (hoursAgo < 6) importance += 2;
    else if (hoursAgo < 12) importance += 1;
    importance = Math.min(10, Math.max(1, importance));

    clusters.push({
      id: `cluster-${clusters.length + 1}`,
      topic: mainArticle.title.slice(0, 80),
      category: mainArticle.category,
      importance,
      articles: clusterArticles,
    });
  }

  return clusters;
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

  // If we don't have enough in a category, fill from others
  const totalTarget = Object.values(TARGET_CLUSTERS).reduce((a, b) => a + b, 0);
  if (selected.length < totalTarget) {
    const remaining = clusters
      .filter((c) => !selected.includes(c))
      .sort((a, b) => b.importance - a.importance);
    selected.push(...remaining.slice(0, totalTarget - selected.length));
  }

  // Sort final selection by importance
  return selected.sort((a, b) => b.importance - a.importance);
}

/**
 * Main clustering function
 */
function cluster(): void {
  console.log('🔗 AVACTU - Script de clustering (TF-IDF local)');
  console.log('================================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  // Load raw articles
  if (!existsSync(RAW_ARTICLES_PATH)) {
    console.error('❌ Erreur: raw-articles.json non trouvé');
    console.error("   Exécutez d'abord: npm run curate");
    process.exit(1);
  }

  const rawData: RawArticlesInput = JSON.parse(readFileSync(RAW_ARTICLES_PATH, 'utf-8'));
  console.log(`📚 ${rawData.articleCount} articles bruts chargés\n`);

  // Cluster articles
  console.log('🤖 Clustering TF-IDF en cours...');
  const startTime = Date.now();
  const allClusters = clusterArticles(rawData.articles);
  const duration = Date.now() - startTime;
  console.log(`   → ${allClusters.length} clusters identifiés en ${duration}ms\n`);

  // Log clusters with multiple articles
  console.log('📊 Clusters multi-sources :');
  const multiSource = allClusters.filter((c) => c.articles.length > 1);
  for (const cluster of multiSource.slice(0, 10)) {
    const sources = [...new Set(cluster.articles.map((a) => a.source))];
    console.log(
      `   [${cluster.category.slice(0, 4).toUpperCase()}] (${cluster.importance}/10) ${cluster.topic.slice(0, 50)}...`
    );
    console.log(`      → ${cluster.articles.length} articles: ${sources.join(', ')}`);
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
  console.log('\n================================================');
  console.log('📊 RÉSUMÉ');
  console.log('================================================');

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
  const multiSourceClusters = selectedClusters.filter((c) => c.articles.length > 1).length;
  console.log(`\nTotal articles dans les clusters: ${totalArticles}`);
  console.log(`Clusters multi-sources: ${multiSourceClusters}/${selectedClusters.length}`);

  console.log(`\n✅ Sauvegardé dans: ${CLUSTERED_PATH}`);
}

// Run
cluster();
