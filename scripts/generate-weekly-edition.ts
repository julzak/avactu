/**
 * Generate Weekly Edition Script
 *
 * Aggregates stories from the last 7 days from newsletter_editions table,
 * scores them by recency and category diversity, selects top 10,
 * and saves to public/data/weekly-stories.json
 *
 * Usage: npm run generate-weekly
 *
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 *   - newsletter_editions table populated with daily editions
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
type Category = 'geopolitique' | 'monde';

interface Location {
  lat: number;
  lng: number;
  name: string;
}

interface Story {
  id: string;
  category: Category;
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

interface NewsletterEdition {
  id: string;
  edition_date: string;
  stories_json: Story[];
  created_at: string;
}

interface ScoredStory extends Story {
  score: number;
  editionDate: string;
}

// Constants
const WEEKLY_STORIES_PATH = join(__dirname, '..', 'public', 'data', 'weekly-stories.json');
const TARGET_STORY_COUNT = 10;

// Category target distribution (60/40 ratio)
const CATEGORY_TARGETS: Record<Category, number> = {
  geopolitique: 6, // 60%
  monde: 4, // 40%
};

/**
 * Calculate recency score (newer = higher score)
 * Score from 1.0 (today) to 0.3 (7 days ago)
 */
function getRecencyScore(editionDate: string): number {
  const now = new Date();
  const date = new Date(editionDate);
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0.3, 1 - daysDiff * 0.1);
}

/**
 * Select top stories with category diversity
 */
function selectTopStories(allStories: ScoredStory[]): Story[] {
  // Sort by score descending
  const sorted = [...allStories].sort((a, b) => b.score - a.score);

  const selected: Story[] = [];
  const categoryCount: Record<Category, number> = {
    geopolitique: 0,
    monde: 0,
  };

  // First pass: fill category quotas with best stories
  for (const story of sorted) {
    if (selected.length >= TARGET_STORY_COUNT) break;

    const target = CATEGORY_TARGETS[story.category];
    if (categoryCount[story.category] < target) {
      selected.push(story);
      categoryCount[story.category]++;
    }
  }

  // Second pass: fill remaining slots with best remaining stories
  for (const story of sorted) {
    if (selected.length >= TARGET_STORY_COUNT) break;
    if (!selected.find((s) => s.id === story.id)) {
      selected.push(story);
    }
  }

  // Final sort by category order then score
  const categoryOrder: Category[] = ['geopolitique', 'monde'];
  return selected.sort((a, b) => {
    const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return (b as ScoredStory).score - (a as ScoredStory).score;
  });
}

/**
 * Main function
 */
async function generateWeeklyEdition(): Promise<void> {
  console.log('📅 AVACTU - Génération de l\'édition hebdomadaire');
  console.log('================================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erreur: SUPABASE_URL ou SUPABASE_SERVICE_KEY non définie');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Calculate date range (last 7 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`📆 Période: ${startDateStr} → ${endDateStr}\n`);

  // Fetch editions from last 7 days
  const { data: editions, error: fetchError } = await supabase
    .from('newsletter_editions')
    .select('*')
    .gte('edition_date', startDateStr)
    .lte('edition_date', endDateStr)
    .order('edition_date', { ascending: false });

  if (fetchError) {
    console.error('❌ Erreur fetch editions:', fetchError.message);
    process.exit(1);
  }

  if (!editions || editions.length === 0) {
    console.error('❌ Aucune édition trouvée pour la période');
    process.exit(1);
  }

  console.log(`📰 ${editions.length} éditions trouvées\n`);

  // Collect and score all stories
  const allStories: ScoredStory[] = [];
  const seenTitles = new Set<string>();

  for (const edition of editions as NewsletterEdition[]) {
    const recencyScore = getRecencyScore(edition.edition_date);

    for (const story of edition.stories_json) {
      // Skip duplicates (same title)
      const normalizedTitle = story.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) continue;
      seenTitles.add(normalizedTitle);

      allStories.push({
        ...story,
        score: recencyScore,
        editionDate: edition.edition_date,
      });
    }
  }

  console.log(`📊 ${allStories.length} stories uniques collectées\n`);

  // Log category distribution
  const categoryDistribution: Record<Category, number> = {
    geopolitique: 0,
    monde: 0,
  };
  for (const story of allStories) {
    if (categoryDistribution[story.category] !== undefined) {
      categoryDistribution[story.category]++;
    }
  }
  console.log('Distribution par catégorie:');
  console.log(`   Géopolitique: ${categoryDistribution.geopolitique}`);
  console.log(`   Monde: ${categoryDistribution.monde}\n`);

  // Select top 10 stories
  const selectedStories = selectTopStories(allStories);

  console.log(`✅ ${selectedStories.length} stories sélectionnées:\n`);
  for (const story of selectedStories) {
    const scoredStory = story as ScoredStory;
    console.log(`   [${story.category}] ${story.title.substring(0, 50)}... (score: ${scoredStory.score?.toFixed(2) || 'N/A'})`);
  }

  // Create weekly edition - remove score and editionDate from ScoredStory
  const weeklyEdition: Edition = {
    date: new Date().toISOString().split('T')[0],
    stories: selectedStories.map((s) => {
      const { score, editionDate, ...story } = s as ScoredStory;
      return story;
    }),
  };

  // Save to file
  writeFileSync(WEEKLY_STORIES_PATH, JSON.stringify(weeklyEdition, null, 2));

  console.log(`\n💾 Édition hebdomadaire sauvegardée: ${WEEKLY_STORIES_PATH}`);
  console.log('\n✅ Génération terminée !');
}

// Run
generateWeeklyEdition().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
