/**
 * Curation Script - Récupère les articles des dernières 48h depuis les flux RSS
 *
 * Usage: npx tsx scripts/curate.ts
 */

import { createHash } from 'crypto';
import Parser from 'rss-parser';
import metascraper from 'metascraper';
import metascraperImage from 'metascraper-image';
import metascraperTitle from 'metascraper-title';
import metascraperDescription from 'metascraper-description';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isValidEditorialImage } from './image-validation.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface Source {
  name: string;
  url: string;
  category: 'geopolitique' | 'tech' | 'eco';
}

interface SourcesConfig {
  sources: Source[];
}

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

interface RawArticlesOutput {
  generatedAt: string;
  articleCount: number;
  articles: RawArticle[];
}

// Initialize RSS parser
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Avactu/1.0 (News Aggregator)',
  },
});

// Initialize metascraper for og:image extraction
const scraper = metascraper([
  metascraperImage(),
  metascraperTitle(),
  metascraperDescription(),
]);

// Constants
const HOURS_24 = 24 * 60 * 60 * 1000;
const CONFIG_PATH = join(__dirname, '..', 'config', 'sources.json');
const OUTPUT_PATH = join(__dirname, '..', 'data', 'raw-articles.json');

/**
 * Load sources configuration
 */
function loadSources(): Source[] {
  const configContent = readFileSync(CONFIG_PATH, 'utf-8');
  const config: SourcesConfig = JSON.parse(configContent);
  return config.sources;
}

/**
 * Check if article is within the last 48 hours
 */
function isWithin24Hours(dateString: string | undefined): boolean {
  if (!dateString) return false;

  const articleDate = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - articleDate.getTime();

  return diff <= HOURS_24 && diff >= 0;
}

/**
 * Detect non-French titles (Spanish, Portuguese, Italian, etc.)
 * English titles are allowed (BBC, Reuters, The Verge, Ars Technica)
 */
function isNonFrenchTitle(title: string): boolean {
  const lower = title.toLowerCase();
  const words = lower.split(/\s+/);

  // Spanish/Portuguese markers (words that almost never appear in French or English)
  const nonFrenchMarkers = [
    'según', 'también', 'pero', 'sobre', 'gobierno', 'países', 'puede', 'tiene',
    'está', 'hace', 'entre', 'como', 'desde', 'hasta', 'después', 'antes',
    'mejor', 'todos', 'cada', 'otro', 'otra', 'otros', 'otras', 'nuevo', 'nueva',
    'contra', 'mientras', 'ahora', 'aquí', 'donde', 'porque', 'aunque',
    'hacia', 'según', 'através', 'ainda', 'muito', 'também', 'quando',
    'porque', 'ainda', 'foram', 'após', 'então', 'será', 'isso',
    'nella', 'della', 'delle', 'degli', 'questo', 'questa', 'questi', 'perché',
    'hanno', 'sono', 'stato', 'anche', 'dopo', 'ancora', 'molto',
  ];

  const markerCount = words.filter(w => nonFrenchMarkers.includes(w)).length;
  return markerCount >= 2;
}

/**
 * Generate a unique ID for an article
 */
function generateArticleId(url: string, publishedAt: string): string {
  const date = new Date(publishedAt);
  const dateStr = date.toISOString().split('T')[0];
  const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 8);
  return `${dateStr}-${urlHash}`;
}

/**
 * Fetch og:image from article URL with retry
 */
async function fetchOgImage(url: string, retries = 1): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Avactu/1.0 (News Aggregator)',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) return null;

      const html = await response.text();
      const metadata = await scraper({ html, url });

      return metadata.image || null;
    } catch {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      console.warn(`  ⚠ Could not fetch og:image for ${url}`);
      return null;
    }
  }
  return null;
}

/**
 * Parse a single RSS feed
 */
async function parseFeed(source: Source): Promise<RawArticle[]> {
  console.log(`\n📡 Fetching: ${source.name}`);

  try {
    const feed = await parser.parseURL(source.url);
    const articles: RawArticle[] = [];
    const now = new Date().toISOString();

    console.log(`   Found ${feed.items?.length || 0} items`);

    for (const item of feed.items || []) {
      // Check if article is within 48 hours
      const pubDate = item.pubDate || item.isoDate;
      if (!isWithin24Hours(pubDate)) {
        continue;
      }

      const url = item.link || '';
      const publishedAt = new Date(pubDate!).toISOString();

      // Try to get image from feed first, then fetch og:image
      let imageUrl = item.enclosure?.url || null;

      // Extract image from content if available
      if (!imageUrl && item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }

      // Fetch og:image if no image found
      if (!imageUrl && url) {
        imageUrl = await fetchOgImage(url);
      }

      // Validate image: reject logos, placeholders, and generic images
      if (imageUrl && !isValidEditorialImage(imageUrl)) {
        console.warn(`   ⚠ Image rejetée (logo/placeholder): ${imageUrl}`);
        imageUrl = null;
      }

      // Filter out non-French titles (Spanish, Portuguese, etc. from Courrier International / Reuters)
      const title = item.title || 'Sans titre';
      if (isNonFrenchTitle(title)) {
        console.log(`   ⊘ Titre non-français rejeté: ${title.slice(0, 60)}...`);
        continue;
      }

      const article: RawArticle = {
        id: generateArticleId(url, publishedAt),
        title,
        description: item.contentSnippet || item.content?.replace(/<[^>]*>/g, '').slice(0, 500) || '',
        url,
        imageUrl,
        source: source.name,
        category: source.category,
        publishedAt,
        fetchedAt: now,
      };

      articles.push(article);
      console.log(`   ✓ ${article.title.slice(0, 50)}...`);
    }

    console.log(`   → ${articles.length} articles dans les dernières 48h`);
    return articles;

  } catch (error) {
    console.error(`   ✗ Error fetching ${source.name}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Remove duplicate articles based on URL
 */
function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seen = new Map<string, RawArticle>();

  for (const article of articles) {
    // Use URL as unique key
    if (!seen.has(article.url)) {
      seen.set(article.url, article);
    }
  }

  return Array.from(seen.values());
}

/**
 * Sort articles by date (most recent first)
 */
function sortByDate(articles: RawArticle[]): RawArticle[] {
  return articles.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Main curation function
 */
async function curate(): Promise<void> {
  console.log('🔍 AVACTU - Script de curation');
  console.log('================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}`);
  console.log(`⏱  Fenêtre: dernières 24 heures\n`);

  // Load sources
  const sources = loadSources();
  console.log(`📚 ${sources.length} sources configurées`);

  // Fetch all feeds in parallel (batches of 4 to avoid overwhelming connections)
  const allArticles: RawArticle[] = [];
  const BATCH_SIZE = 4;

  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(source => parseFeed(source)));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    }
  }

  // Deduplicate and sort
  const uniqueArticles = deduplicateArticles(allArticles);
  const sortedArticles = sortByDate(uniqueArticles);

  // Prepare output
  const output: RawArticlesOutput = {
    generatedAt: new Date().toISOString(),
    articleCount: sortedArticles.length,
    articles: sortedArticles,
  };

  // Ensure data directory exists
  const dataDir = dirname(OUTPUT_PATH);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  // Summary
  console.log('\n================================');
  console.log('📊 RÉSUMÉ');
  console.log('================================');
  console.log(`Total articles récupérés: ${allArticles.length}`);
  console.log(`Articles uniques: ${uniqueArticles.length}`);
  console.log(`\nPar catégorie:`);

  const byCategory = sortedArticles.reduce((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`  • Géopolitique: ${byCategory.geopolitique || 0}`);
  console.log(`  • Tech: ${byCategory.tech || 0}`);
  console.log(`  • Éco: ${byCategory.eco || 0}`);

  console.log(`\n✅ Sauvegardé dans: ${OUTPUT_PATH}`);
}

// Run
curate().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
