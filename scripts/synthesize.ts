/**
 * Synthesis Script - Génère les stories via Claude API
 *
 * Usage: npm run synthesize
 *
 * Prérequis:
 *   - ANTHROPIC_API_KEY dans les variables d'environnement
 *   - data/raw-articles.json généré par npm run curate
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
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

interface Location {
  lat: number;
  lng: number;
  name: string;
}

interface Story {
  id: string;
  category: 'geopolitique' | 'economie' | 'politique';
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
const RAW_ARTICLES_PATH = join(__dirname, '..', 'data', 'raw-articles.json');
const STORIES_PATH = join(__dirname, '..', 'public', 'data', 'stories.json');

// Ratio de contenu selon CLAUDE.md
const CATEGORY_RATIO = {
  geopolitique: 4, // ~70%
  economie: 1,     // ~20%
  politique: 1,    // ~10%
} as const;

const MAX_STORIES = 6;

// System prompt pour Claude
const SYSTEM_PROMPT = `Tu es un analyste géopolitique senior au Quai d'Orsay. Tu rédiges des notes de synthèse pour une lectrice de 16 ans à haut potentiel intellectuel.

RÈGLES ABSOLUES :
1. Ne simplifie JAMAIS les concepts (Realpolitik, soft power, balance commerciale, etc.) — clarifie leur rôle dans le contexte
2. Présente TOUJOURS les perspectives des différents acteurs — jamais un angle unique
3. Zéro sensationnalisme, zéro jugement moral, zéro opinion personnelle
4. Identifie TOUJOURS l'enjeu économique sous-jacent, même pour un conflit territorial
5. Contextualise brièvement l'historique si nécessaire à la compréhension

RÈGLES DE FRANÇAIS (TITRE ET BULLETS) :
- Toujours utiliser les articles devant les noms de pays : LA Russie, LA France, LA Chine, LES États-Unis, LE Royaume-Uni, L'Ukraine, L'Iran
- Toujours utiliser les articles devant les lieux géographiques : LE Groenland, LA Crimée, LE Moyen-Orient, LA Mer de Chine, LE Détroit de Taïwan
- Toujours utiliser les articles devant les groupes de personnes : LES influenceurs, LES médecins, LES particuliers
- Toujours utiliser les articles devant les concepts : L'usage, LA stratégie, LE contrôle, LA domination
- Forme correcte : "La Russie bombarde Kiev" PAS "Russie bombarde Kiev"
- Forme correcte : "Les médecins alertent" PAS "Médecins alertent"
- Forme correcte : "L'usage de la force" PAS "Usage de la force"

FORMAT DE SORTIE (JSON strict, pas de markdown) :
{
  "title": "Titre factuel et accrocheur avec articles corrects (max 60 caractères)",
  "category": "geopolitique" | "economie" | "politique",
  "location": {
    "lat": <latitude du lieu clé>,
    "lng": <longitude du lieu clé>,
    "name": "Nom du lieu (ville, région, détroit, etc.)"
  },
  "bullets": [
    "Point 1 : Qui fait quoi — le fait brut (max 15 mots)",
    "Point 2 : Pourquoi maintenant — le déclencheur (max 15 mots)",
    "Point 3 : Position de l'acteur A (max 15 mots)",
    "Point 4 : Position de l'acteur B ou adversaire (max 15 mots)",
    "Point 5 : L'enjeu économique ou stratégique (max 15 mots)"
  ],
  "execSummary": "Analyse structurée de 200-250 mots : (1) Contexte historique en 2 phrases max, (2) Situation actuelle factuelle, (3) Perspectives divergentes des acteurs, (4) Conséquences possibles et enjeux futurs."
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

/**
 * Select articles based on category ratio
 */
function selectArticles(articles: RawArticle[]): RawArticle[] {
  const selected: RawArticle[] = [];
  const byCategory = {
    geopolitique: articles.filter((a) => a.category === 'geopolitique'),
    economie: articles.filter((a) => a.category === 'economie'),
    politique: articles.filter((a) => a.category === 'politique'),
  };

  // Select based on ratio
  const totalRatio = CATEGORY_RATIO.geopolitique + CATEGORY_RATIO.economie + CATEGORY_RATIO.politique;

  for (const [category, ratio] of Object.entries(CATEGORY_RATIO)) {
    const count = Math.round((ratio / totalRatio) * MAX_STORIES);
    const categoryArticles = byCategory[category as keyof typeof byCategory];
    selected.push(...categoryArticles.slice(0, count));
  }

  // Trim to max
  return selected.slice(0, MAX_STORIES);
}

/**
 * Group related articles (same topic/event)
 */
function groupRelatedArticles(articles: RawArticle[]): RawArticle[][] {
  // Simple grouping: each article is its own group for now
  // Could be enhanced with NLP/embedding similarity
  return articles.map((article) => [article]);
}

/**
 * Synthesize a single story from article group
 */
async function synthesizeStory(
  client: Anthropic,
  articleGroup: RawArticle[],
  storyIndex: number
): Promise<Story | null> {
  const mainArticle = articleGroup[0];
  const allSources = [...new Set(articleGroup.map((a) => a.source))];

  const userPrompt = `Synthétise cette actualité en une story pour l'application Avactu.

ARTICLE PRINCIPAL :
Titre: ${mainArticle.title}
Source: ${mainArticle.source}
Description: ${mainArticle.description}
URL: ${mainArticle.url}

${articleGroup.length > 1 ? `ARTICLES CONNEXES :\n${articleGroup.slice(1).map((a) => `- ${a.title} (${a.source})`).join('\n')}` : ''}

Génère la story au format JSON demandé.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
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

    // Parse JSON response
    const storyData = JSON.parse(jsonText);

    // Generate story ID
    const today = new Date().toISOString().split('T')[0];
    const id = `${today}-${String(storyIndex + 1).padStart(2, '0')}`;

    const story: Story = {
      id,
      category: storyData.category || mainArticle.category,
      title: storyData.title,
      imageUrl: mainArticle.imageUrl || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
      location: storyData.location,
      bullets: storyData.bullets,
      execSummary: storyData.execSummary,
      sources: allSources,
      publishedAt: mainArticle.publishedAt,
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
  console.log('🧠 AVACTU - Script de synthèse');
  console.log('==============================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Erreur: ANTHROPIC_API_KEY non définie');
    console.error('   Export la variable: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  // Load raw articles
  if (!existsSync(RAW_ARTICLES_PATH)) {
    console.error('❌ Erreur: raw-articles.json non trouvé');
    console.error('   Exécutez d\'abord: npm run curate');
    process.exit(1);
  }

  const rawData: RawArticlesInput = JSON.parse(readFileSync(RAW_ARTICLES_PATH, 'utf-8'));
  console.log(`📚 ${rawData.articleCount} articles bruts chargés`);

  // Select articles based on ratio
  const selectedArticles = selectArticles(rawData.articles);
  console.log(`🎯 ${selectedArticles.length} articles sélectionnés pour synthèse\n`);

  // Group related articles
  const articleGroups = groupRelatedArticles(selectedArticles);

  // Initialize Anthropic client
  const client = new Anthropic();

  // Synthesize stories
  const stories: Story[] = [];

  for (let i = 0; i < articleGroups.length; i++) {
    const group = articleGroups[i];
    console.log(`📝 Synthèse ${i + 1}/${articleGroups.length}: ${group[0].title.slice(0, 50)}...`);

    const story = await synthesizeStory(client, group, i);
    if (story) {
      stories.push(story);
      console.log(`   ✓ "${story.title}"`);
    }

    // Rate limiting
    if (i < articleGroups.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Create edition
  const edition: Edition = {
    date: new Date().toISOString(),
    stories,
  };

  // Write output
  writeFileSync(STORIES_PATH, JSON.stringify(edition, null, 2), 'utf-8');

  // Summary
  console.log('\n==============================');
  console.log('📊 RÉSUMÉ');
  console.log('==============================');
  console.log(`Stories générées: ${stories.length}`);

  const byCategory = stories.reduce((acc, story) => {
    acc[story.category] = (acc[story.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\nPar catégorie:`);
  console.log(`  • Géopolitique: ${byCategory.geopolitique || 0}`);
  console.log(`  • Économie: ${byCategory.economie || 0}`);
  console.log(`  • Politique: ${byCategory.politique || 0}`);

  console.log(`\n✅ Sauvegardé dans: ${STORIES_PATH}`);
}

// Run
synthesize().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
