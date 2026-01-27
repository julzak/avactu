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

// Design System "Tactical Midnight"
const COLORS = {
  bgPrimary: '#05070A',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748b',
  border: 'rgba(148, 163, 184, 0.2)',
} as const;

const CATEGORY_CONFIG = {
  geopolitique: { emoji: '🔴', label: 'Géopolitique', color: '#f43f5e' },
  economie: { emoji: '🔵', label: 'Économie', color: '#0ea5e9' },
  politique: { emoji: '🟣', label: 'Politique', color: '#8b5cf6' },
} as const;

/**
 * Generate HTML email content - Tactical Midnight Design
 */
function generateEmailHtml(stories: Story[], editionDate: string): string {
  const formattedDate = new Date(editionDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const storiesHtml = stories
    .map((story) => {
      const config = CATEGORY_CONFIG[story.category];
      const bulletsHtml = story.bullets
        .map((b, i) => `
          <tr>
            <td style="padding: 4px 12px 4px 0; vertical-align: top; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 10px; color: ${COLORS.textSecondary};">${i + 1}</td>
            <td style="padding: 4px 0; vertical-align: top; font-family: Georgia, serif; font-size: 14px; line-height: 1.5; color: ${COLORS.textSecondary};">${b}</td>
          </tr>
        `)
        .join('');

      return `
        <tr>
          <td style="padding-bottom: 28px;">
            <!-- Category + Location -->
            <p style="margin: 0 0 8px 0; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">
              <span style="color: ${config.color};">${config.emoji} ${config.label}</span>
              <span style="color: ${COLORS.textSecondary}; margin-left: 12px;">${story.location.name}</span>
            </p>

            <!-- Title -->
            <h2 style="margin: 0 0 12px 0; font-family: Georgia, serif; font-size: 18px; font-weight: 600; line-height: 1.3; color: ${COLORS.textPrimary};">
              ${story.title}
            </h2>

            <!-- Bullets -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              ${bulletsHtml}
            </table>
          </td>
        </tr>

        <!-- Separator -->
        <tr>
          <td style="padding-bottom: 28px;">
            <div style="height: 1px; background: linear-gradient(to right, transparent, ${COLORS.textSecondary}, transparent); opacity: 0.2;"></div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Avactu — Briefing du ${formattedDate}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bgPrimary}; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${COLORS.bgPrimary};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <img src="${APP_URL}/icon-192.svg" alt="Avactu" width="48" height="48" style="display: block; border: 0;" />
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px;">
              <p style="margin: 0 0 16px 0; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: ${COLORS.textSecondary};">
                Briefing du ${formattedDate}
              </p>
              <div style="height: 1px; background-color: ${COLORS.textSecondary}; opacity: 0.3;"></div>
            </td>
          </tr>

          <!-- Stories -->
          ${storiesHtml}

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 20px 0 40px 0;">
              <a href="${APP_URL}" style="display: inline-block; padding: 14px 28px; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${COLORS.textPrimary}; text-decoration: none; border: 1px solid ${COLORS.textSecondary}; border-radius: 8px;">
                Lire l'analyse complète
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid ${COLORS.border};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 11px; color: ${COLORS.textSecondary}; letter-spacing: 0.5px;">
                      Avactu — L'essentiel, sans le bruit.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; font-size: 10px; color: ${COLORS.textMuted};">
                      Tu reçois cet email car tu t'es abonné sur avactu.vercel.app
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(stories: Story[], editionDate: string): string {
  const formattedDate = new Date(editionDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const storiesText = stories
    .map((story) => {
      const config = CATEGORY_CONFIG[story.category];
      const bullets = story.bullets.map((b, i) => `  ${i + 1}. ${b}`).join('\n');
      return `${config.emoji} ${config.label.toUpperCase()} — ${story.location.name}\n${story.title}\n\n${bullets}`;
    })
    .join('\n\n—————\n\n');

  return `BRIEFING DU ${formattedDate.toUpperCase()}

${storiesText}

—————

Lire l'analyse complète : ${APP_URL}

Avactu — L'essentiel, sans le bruit.
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
        from: 'Avactu <onboarding@resend.dev>',
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
