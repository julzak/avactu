/**
 * Newsletter Script - Envoie les stories par email aux abonnés
 *
 * Usage: npm run send-newsletter
 *
 * Prérequis:
 *   - SUPABASE_URL et SUPABASE_SERVICE_KEY dans les variables d'environnement
 *   - RESEND_API_KEY dans les variables d'environnement
 *   - public/data/stories.json généré par npm run synthesize
 */

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
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

interface Subscriber {
  id: string;
  email: string;
  confirmed: boolean;
}

// Constants
const STORIES_PATH = join(__dirname, '..', 'public', 'data', 'stories.json');
const APP_URL = process.env.APP_URL || 'https://avactu.vercel.app';

const CATEGORY_EMOJI = {
  geopolitique: '🌍',
  economie: '📈',
  politique: '🏛️',
} as const;

const CATEGORY_COLOR = {
  geopolitique: '#f43f5e',
  economie: '#06b6d4',
  politique: '#8b5cf6',
} as const;

/**
 * Generate HTML email content
 */
function generateEmailHtml(stories: Story[], editionDate: string): string {
  const formattedDate = new Date(editionDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const storiesHtml = stories
    .map((story) => {
      const emoji = CATEGORY_EMOJI[story.category];
      const color = CATEGORY_COLOR[story.category];
      const bulletsHtml = story.bullets
        .slice(0, 3)
        .map((b) => `<li style="margin-bottom: 4px; color: #94a3b8;">${b}</li>`)
        .join('');

      return `
        <div style="margin-bottom: 24px; padding: 16px; background: #1e293b; border-radius: 12px; border-left: 3px solid ${color};">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            ${emoji} ${story.location.name}
          </div>
          <h2 style="font-size: 18px; font-weight: 600; color: #f8fafc; margin: 0 0 12px 0; line-height: 1.3;">
            ${story.title}
          </h2>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">
            ${bulletsHtml}
          </ul>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Avactu - ${formattedDate}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 700; color: #f8fafc; margin: 0 0 8px 0; letter-spacing: -0.5px;">
            Avactu
          </h1>
          <p style="font-size: 12px; color: #64748b; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
            ${formattedDate}
          </p>
        </div>

        <!-- Stories -->
        ${storiesHtml}

        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${APP_URL}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Lire sur Avactu →
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 24px; border-top: 1px solid #334155;">
          <p style="font-size: 12px; color: #64748b; margin: 0;">
            Tu reçois cet email car tu t'es abonné(e) à Avactu.
          </p>
          <p style="font-size: 11px; color: #475569; margin: 8px 0 0 0;">
            L'actualité mondiale en 15 minutes, tous les 2 jours.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(stories: Story[], editionDate: string): string {
  const formattedDate = new Date(editionDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const storiesText = stories
    .map((story) => {
      const emoji = CATEGORY_EMOJI[story.category];
      const bullets = story.bullets.slice(0, 3).map((b) => `  • ${b}`).join('\n');
      return `${emoji} ${story.location.name}\n${story.title}\n${bullets}`;
    })
    .join('\n\n---\n\n');

  return `AVACTU - ${formattedDate}

${storiesText}

---

Lire sur Avactu : ${APP_URL}

Tu reçois cet email car tu t'es abonné(e) à Avactu.
L'actualité mondiale en 15 minutes, tous les 2 jours.
`;
}

/**
 * Main newsletter function
 */
async function sendNewsletter(): Promise<void> {
  console.log('📧 AVACTU - Envoi de la newsletter');
  console.log('===================================');
  console.log(`📅 Date: ${new Date().toLocaleString('fr-FR')}\n`);

  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erreur: SUPABASE_URL ou SUPABASE_SERVICE_KEY non définie');
    process.exit(1);
  }

  if (!resendApiKey) {
    console.error('❌ Erreur: RESEND_API_KEY non définie');
    process.exit(1);
  }

  // Load stories
  if (!existsSync(STORIES_PATH)) {
    console.error('❌ Erreur: stories.json non trouvé');
    process.exit(1);
  }

  const edition: Edition = JSON.parse(readFileSync(STORIES_PATH, 'utf-8'));
  console.log(`📰 ${edition.stories.length} stories chargées\n`);

  // Initialize clients
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const resend = new Resend(resendApiKey);

  // Fetch confirmed subscribers
  const { data: subscribers, error: fetchError } = await supabase
    .from('subscribers')
    .select('id, email, confirmed')
    .eq('confirmed', true);

  if (fetchError) {
    console.error('❌ Erreur fetch subscribers:', fetchError.message);
    process.exit(1);
  }

  if (!subscribers || subscribers.length === 0) {
    console.log('ℹ️  Aucun abonné confirmé, newsletter non envoyée');
    return;
  }

  console.log(`👥 ${subscribers.length} abonnés confirmés\n`);

  // Generate email content
  const htmlContent = generateEmailHtml(edition.stories, edition.date);
  const textContent = generateEmailText(edition.stories, edition.date);

  const formattedDate = new Date(edition.date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });

  // Send emails
  let successCount = 0;
  let errorCount = 0;

  for (const subscriber of subscribers as Subscriber[]) {
    try {
      await resend.emails.send({
        from: 'Avactu <newsletter@avactu.vercel.app>',
        to: subscriber.email,
        subject: `Avactu du ${formattedDate} - ${edition.stories.length} actus`,
        html: htmlContent,
        text: textContent,
      });

      successCount++;
      console.log(`   ✓ ${subscriber.email}`);
    } catch (err) {
      errorCount++;
      console.error(`   ✗ ${subscriber.email}: ${err instanceof Error ? err.message : err}`);
    }

    // Rate limiting (Resend free tier: 100/day, 1/second)
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  // Summary
  console.log('\n===================================');
  console.log('📊 RÉSUMÉ');
  console.log('===================================');
  console.log(`Emails envoyés: ${successCount}`);
  console.log(`Erreurs: ${errorCount}`);
  console.log(`\n✅ Newsletter envoyée !`);
}

// Run
sendNewsletter().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
