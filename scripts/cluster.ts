/**
 * Clustering Script - Regroupe les articles par sujet similaire
 *
 * Algorithme amélioré :
 * - Extraction d'entités nommées (pays, villes, personnalités)
 * - Matching cross-langue FR/EN
 * - Filtre anti-sport/divertissement
 * - TF-IDF + entités pour meilleure similarité
 *
 * Usage: npm run cluster
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const TARGET_CLUSTERS = {
  geopolitique: 4,
  economie: 1,
  politique: 1,
};

// Mots-clés sport/divertissement à exclure
const EXCLUDED_KEYWORDS = new Set([
  // Sports
  'football', 'soccer', 'cricket', 'rugby', 'tennis', 'basketball', 'golf',
  'match', 'goal', 'scored', 'league', 'championship', 'tournament', 'cup',
  'premier league', 'la liga', 'serie a', 'bundesliga', 'champions league',
  'world cup', 'euro', 'olympic', 'olympics', 'athlete', 'player', 'coach',
  'team', 'club', 'stadium', 'referee', 'penalty', 'offside', 'halftime',
  'mbappe', 'mbappé', 'ronaldo', 'messi', 'haaland', 'real madrid', 'barcelona',
  'manchester', 'liverpool', 'arsenal', 'chelsea', 'psg', 'bayern',
  't20', 'icc', 'odi', 'test match', 'wicket', 'batsman', 'bowler',
  // Divertissement
  'celebrity', 'movie', 'film', 'actor', 'actress', 'singer', 'concert',
  'album', 'grammy', 'oscar', 'emmy', 'netflix', 'disney', 'streaming',
  'reality show', 'kardashian', 'taylor swift', 'beyonce',
]);

// Entités géopolitiques importantes (pays, régions, organisations)
const GEO_ENTITIES: Record<string, string[]> = {
  'ukraine': ['ukraine', 'ukrainian', 'ukrainien', 'kiev', 'kyiv', 'kharkiv', 'zelensky', 'zelenskyy'],
  'russia': ['russia', 'russian', 'russie', 'russe', 'moscow', 'moscou', 'kremlin', 'putin', 'poutine'],
  'usa': ['united states', 'états-unis', 'etats-unis', 'usa', 'american', 'américain', 'washington', 'white house', 'maison blanche', 'trump', 'biden'],
  'china': ['china', 'chinese', 'chine', 'chinois', 'beijing', 'pékin', 'xi jinping'],
  'israel': ['israel', 'israeli', 'israël', 'israélien', 'tel aviv', 'jerusalem', 'netanyahu'],
  'palestine': ['palestine', 'palestinian', 'palestinien', 'gaza', 'hamas', 'west bank', 'cisjordanie'],
  'iran': ['iran', 'iranian', 'iranien', 'tehran', 'téhéran', 'khamenei'],
  'syria': ['syria', 'syrian', 'syrie', 'syrien', 'damascus', 'damas', 'assad', 'sdf', 'kurde', 'kurdish'],
  'france': ['france', 'french', 'français', 'paris', 'macron', 'élysée'],
  'germany': ['germany', 'german', 'allemagne', 'allemand', 'berlin', 'scholz'],
  'uk': ['united kingdom', 'royaume-uni', 'britain', 'british', 'britannique', 'london', 'londres', 'starmer', 'sunak'],
  'eu': ['european union', 'union européenne', 'brussels', 'bruxelles', 'eu', 'ue'],
  'nato': ['nato', 'otan', 'alliance atlantique'],
  'un': ['united nations', 'nations unies', 'onu', 'un'],
  'minneapolis': ['minneapolis', 'minnesota', 'border patrol', 'ice', 'immigration'],
  'greenland': ['greenland', 'groenland', 'denmark', 'danemark'],
  'panama': ['panama', 'canal'],
  'taiwan': ['taiwan', 'taïwan', 'taipei'],
  'north_korea': ['north korea', 'corée du nord', 'pyongyang', 'kim jong'],
  'sudan': ['sudan', 'soudan', 'khartoum'],
  'myanmar': ['myanmar', 'birmanie', 'burma'],
  'algeria': ['algeria', 'algérie', 'alger', 'algiers'],
  'iraq': ['iraq', 'irak', 'baghdad', 'bagdad'],
  'india': ['india', 'indian', 'inde', 'indien', 'indienne', 'new delhi', 'delhi', 'modi'],
  'japan': ['japan', 'japanese', 'japon', 'japonais', 'tokyo'],
  'south_korea': ['south korea', 'corée du sud', 'seoul', 'séoul'],
  'australia': ['australia', 'australian', 'australie', 'australien', 'canberra', 'sydney'],
  'brazil': ['brazil', 'brazilian', 'brésil', 'brésilien', 'brasilia', 'lula'],
  'mexico': ['mexico', 'mexican', 'mexique', 'mexicain'],
  'turkey': ['turkey', 'turkish', 'turquie', 'turc', 'ankara', 'erdogan'],
  'saudi_arabia': ['saudi', 'saoudite', 'riyadh', 'riyad', 'mbs'],
  'chile': ['chile', 'chilean', 'chili', 'chilien', 'santiago'],
  'oman': ['oman', 'omani', 'omanais', 'muscat', 'mascate'],
};

// Stop words FR + EN
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'en', 'au', 'aux',
  'à', 'ce', 'ces', 'cette', 'que', 'qui', 'quoi', 'dont', 'où', 'sur', 'sous',
  'par', 'pour', 'avec', 'sans', 'dans', 'est', 'sont', 'ont', 'être', 'avoir',
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'as', 'after', 'before',
  'news', 'live', 'update', 'breaking', 'latest', 'new', 'nouveau', 'nouvelle',
]);

/**
 * Check if article is about sports/entertainment (should be excluded)
 */
function isSportOrEntertainment(text: string): boolean {
  const lower = text.toLowerCase();
  let matchCount = 0;

  for (const keyword of EXCLUDED_KEYWORDS) {
    if (lower.includes(keyword)) {
      matchCount++;
      if (matchCount >= 2) return true; // Need at least 2 matches to be sure
    }
  }
  return false;
}

/**
 * Extract geo-political entities from text
 */
function extractEntities(text: string): Set<string> {
  const lower = text.toLowerCase();
  const entities = new Set<string>();

  for (const [entity, keywords] of Object.entries(GEO_ENTITIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        entities.add(entity);
        break;
      }
    }
  }

  return entities;
}

/**
 * Tokenize and clean text
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Build TF-IDF vectors
 */
function buildTfIdf(documents: string[][]): Map<string, number>[] {
  const docFreq = new Map<string, number>();
  const numDocs = documents.length;

  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

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
 * Calculate cosine similarity
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
 * Calculate entity-based similarity (Jaccard)
 */
function entitySimilarity(entities1: Set<string>, entities2: Set<string>): number {
  if (entities1.size === 0 || entities2.size === 0) return 0;

  const intersection = new Set([...entities1].filter(x => entities2.has(x)));
  const union = new Set([...entities1, ...entities2]);

  return intersection.size / union.size;
}

/**
 * Combined similarity score
 */
function combinedSimilarity(
  tfidf1: Map<string, number>,
  tfidf2: Map<string, number>,
  entities1: Set<string>,
  entities2: Set<string>
): number {
  const textSim = cosineSimilarity(tfidf1, tfidf2);
  const entSim = entitySimilarity(entities1, entities2);

  // If entities match strongly, boost similarity
  if (entSim >= 0.5) {
    return Math.max(textSim, entSim * 0.8);
  }

  // Weighted combination
  return textSim * 0.6 + entSim * 0.4;
}

/**
 * Cluster articles
 */
function clusterArticles(articles: RawArticle[]): ArticleCluster[] {
  // Filter out sports/entertainment
  const filtered = articles.filter(a => {
    const text = `${a.title} ${a.description}`;
    const exclude = isSportOrEntertainment(text);
    if (exclude) {
      console.log(`   ⚠ Exclu (sport/divertissement): ${a.title.slice(0, 50)}...`);
    }
    return !exclude;
  });

  console.log(`   → ${articles.length - filtered.length} articles sport/divertissement exclus`);

  // Prepare data
  const documents = filtered.map((a) => tokenize(`${a.title} ${a.description}`));
  const entities = filtered.map((a) => extractEntities(`${a.title} ${a.description}`));
  const vectors = buildTfIdf(documents);

  // Greedy clustering with lower threshold
  const SIMILARITY_THRESHOLD = 0.20; // Lowered from 0.25
  const clusters: ArticleCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < filtered.length; i++) {
    if (assigned.has(i)) continue;

    const clusterArticles = [filtered[i]];
    assigned.add(i);

    for (let j = i + 1; j < filtered.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = combinedSimilarity(vectors[i], vectors[j], entities[i], entities[j]);

      if (similarity >= SIMILARITY_THRESHOLD) {
        clusterArticles.push(filtered[j]);
        assigned.add(j);
      }
    }

    const mainArticle = clusterArticles[0];
    const uniqueSources = new Set(clusterArticles.map((a) => a.source));

    // Calculate importance
    const numArticles = clusterArticles.length;
    const numSources = uniqueSources.size;
    const recency = Math.max(...clusterArticles.map((a) => new Date(a.publishedAt).getTime()));
    const hoursAgo = (Date.now() - recency) / (1000 * 60 * 60);

    // Higher weight for multi-source clusters
    let importance = numArticles * 1.5 + numSources * 3;
    if (hoursAgo < 6) importance += 2;
    else if (hoursAgo < 12) importance += 1;
    importance = Math.min(10, Math.max(1, Math.round(importance)));

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
 * Check if two clusters are about the same topic (to avoid duplicates)
 */
function areSameTopic(cluster1: ArticleCluster, cluster2: ArticleCluster): boolean {
  const text1 = cluster1.articles.map(a => `${a.title} ${a.description}`).join(' ');
  const text2 = cluster2.articles.map(a => `${a.title} ${a.description}`).join(' ');

  const entities1 = extractEntities(text1);
  const entities2 = extractEntities(text2);

  // High entity overlap = same topic
  const entSim = entitySimilarity(entities1, entities2);
  if (entSim >= 0.5) return true;

  // Check for shared articles (same URL)
  const urls1 = new Set(cluster1.articles.map(a => a.url));
  const urls2 = new Set(cluster2.articles.map(a => a.url));
  const sharedUrls = [...urls1].filter(u => urls2.has(u)).length;
  if (sharedUrls > 0) return true;

  // Text similarity check (catches same-topic clusters with non-geo entities like person names)
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  const vectors = buildTfIdf([tokens1, tokens2]);
  const textSim = cosineSimilarity(vectors[0], vectors[1]);
  if (textSim >= 0.25) return true;

  return false;
}

/**
 * Select best clusters
 */
function selectBestClusters(clusters: ArticleCluster[]): ArticleCluster[] {
  const selected: ArticleCluster[] = [];

  // Prioritize multi-source clusters
  const multiSource = clusters
    .filter(c => new Set(c.articles.map(a => a.source)).size > 1)
    .sort((a, b) => b.importance - a.importance);

  const singleSource = clusters
    .filter(c => new Set(c.articles.map(a => a.source)).size === 1)
    .sort((a, b) => b.importance - a.importance);

  // Helper to check if cluster is duplicate of already selected
  const isDuplicate = (candidate: ArticleCluster): boolean => {
    return selected.some(s => areSameTopic(s, candidate));
  };

  // Sort by category and importance
  const byCategory = {
    geopolitique: [...multiSource, ...singleSource].filter((c) => c.category === 'geopolitique'),
    economie: [...multiSource, ...singleSource].filter((c) => c.category === 'economie'),
    politique: [...multiSource, ...singleSource].filter((c) => c.category === 'politique'),
  };

  for (const [category, target] of Object.entries(TARGET_CLUSTERS)) {
    const available = byCategory[category as keyof typeof byCategory];
    let added = 0;
    for (const cluster of available) {
      if (added >= target) break;
      if (!isDuplicate(cluster)) {
        selected.push(cluster);
        added++;
      } else {
        console.log(`   ⚠ Doublon ignoré: ${cluster.topic.slice(0, 40)}...`);
      }
    }
  }

  // Fill remaining slots
  const totalTarget = Object.values(TARGET_CLUSTERS).reduce((a, b) => a + b, 0);
  if (selected.length < totalTarget) {
    const allSorted = [...multiSource, ...singleSource];
    for (const cluster of allSorted) {
      if (selected.length >= totalTarget) break;
      if (!selected.includes(cluster) && !isDuplicate(cluster)) {
        selected.push(cluster);
      }
    }
  }

  return selected.sort((a, b) => b.importance - a.importance);
}

/**
 * Main
 */
function cluster(): void {
  console.log('🔗 AVACTU - Clustering amélioré (entités + TF-IDF)');
  console.log('===================================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  if (!existsSync(RAW_ARTICLES_PATH)) {
    console.error('❌ Erreur: raw-articles.json non trouvé');
    process.exit(1);
  }

  const rawData: RawArticlesInput = JSON.parse(readFileSync(RAW_ARTICLES_PATH, 'utf-8'));
  console.log(`📚 ${rawData.articleCount} articles bruts chargés\n`);

  console.log('🔍 Filtrage et clustering...');
  const startTime = Date.now();
  const allClusters = clusterArticles(rawData.articles);
  const duration = Date.now() - startTime;
  console.log(`\n   → ${allClusters.length} clusters en ${duration}ms\n`);

  // Show multi-source clusters
  const multiSource = allClusters.filter((c) => {
    const sources = new Set(c.articles.map((a) => a.source));
    return sources.size > 1;
  });

  console.log(`📊 ${multiSource.length} clusters multi-sources :`);
  for (const cluster of multiSource) {
    const sources = [...new Set(cluster.articles.map((a) => a.source))];
    console.log(`   [${cluster.category.slice(0, 4).toUpperCase()}] ${cluster.topic.slice(0, 50)}...`);
    console.log(`      → ${cluster.articles.length} articles: ${sources.join(' + ')}`);
  }

  const selectedClusters = selectBestClusters(allClusters);
  console.log(`\n🎯 ${selectedClusters.length} clusters sélectionnés`);

  for (const cluster of selectedClusters) {
    const sources = [...new Set(cluster.articles.map((a) => a.source))];
    const multi = sources.length > 1 ? '✓' : ' ';
    console.log(`   ${multi} [${cluster.category.slice(0, 4)}] (${cluster.importance}/10) ${cluster.topic.slice(0, 45)}...`);
  }

  const output: ClusteredOutput = {
    generatedAt: new Date().toISOString(),
    clusterCount: selectedClusters.length,
    clusters: selectedClusters,
  };

  const dataDir = dirname(CLUSTERED_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  writeFileSync(CLUSTERED_PATH, JSON.stringify(output, null, 2), 'utf-8');

  // Summary
  console.log('\n===================================================');
  console.log('📊 RÉSUMÉ');
  console.log('===================================================');

  const byCategory = selectedClusters.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`Par catégorie:`);
  console.log(`  • Géopolitique: ${byCategory.geopolitique || 0}`);
  console.log(`  • Économie: ${byCategory.economie || 0}`);
  console.log(`  • Politique: ${byCategory.politique || 0}`);

  const totalArticles = selectedClusters.reduce((sum, c) => sum + c.articles.length, 0);
  const multiSourceCount = selectedClusters.filter((c) =>
    new Set(c.articles.map(a => a.source)).size > 1
  ).length;

  console.log(`\nArticles utilisés: ${totalArticles}`);
  console.log(`Clusters multi-sources: ${multiSourceCount}/${selectedClusters.length}`);
  console.log(`\n✅ Sauvegardé: ${CLUSTERED_PATH}`);
}

cluster();
