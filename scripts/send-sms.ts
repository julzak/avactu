/**
 * SMS Notification Script - Envoie les titres du jour à Ava via Twilio
 *
 * Usage:
 *   npm run send-sms           # Envoie le SMS
 *   npm run send-sms -- --dry-run  # Affiche le message sans l'envoyer
 */

import Twilio from 'twilio';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES Module __dirname equivalent
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

// Category emojis
const CATEGORY_EMOJI = {
  geopolitique: '🔴',
  economie: '🔵',
  politique: '🟣',
} as const;

// Constants
const STORIES_PATH = join(__dirname, '..', 'public', 'data', 'stories.json');
const APP_URL = process.env.APP_URL || 'avactu.vercel.app';
const MAX_TITLE_LENGTH = 40;

/**
 * Truncate title to max length
 */
function truncateTitle(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 1) + '…';
}

/**
 * Format date in French
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Build SMS message from stories
 */
function buildMessage(edition: Edition): string {
  const dateFormatted = formatDate(edition.date);

  const lines: string[] = [
    `☀️ Avactu du ${dateFormatted}`,
    '',
  ];

  for (const story of edition.stories) {
    const emoji = CATEGORY_EMOJI[story.category];
    const title = truncateTitle(story.title);
    lines.push(`${emoji} ${title}`);
  }

  lines.push('');
  lines.push(`👉 ${APP_URL}`);

  return lines.join('\n');
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const toNumber = process.env.AVA_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    throw new Error(
      'Missing environment variables. Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, AVA_PHONE_NUMBER'
    );
  }

  const client = Twilio(accountSid, authToken);

  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to: toNumber,
  });

  console.log(`✅ SMS envoyé avec succès!`);
  console.log(`   SID: ${result.sid}`);
  console.log(`   Status: ${result.status}`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('📱 AVACTU - Envoi SMS');
  console.log('=====================');

  // Load stories
  let edition: Edition;
  try {
    const content = readFileSync(STORIES_PATH, 'utf-8');
    edition = JSON.parse(content);
  } catch (error) {
    console.error('❌ Erreur: Impossible de lire stories.json');
    console.error('   Exécutez d\'abord: npm run curate && npm run synthesize');
    process.exit(1);
  }

  if (!edition.stories || edition.stories.length === 0) {
    console.error('❌ Erreur: Aucune story trouvée dans stories.json');
    process.exit(1);
  }

  // Build message
  const message = buildMessage(edition);

  console.log('\n📝 Message:');
  console.log('─'.repeat(40));
  console.log(message);
  console.log('─'.repeat(40));
  console.log(`\n📊 ${message.length} caractères`);

  if (isDryRun) {
    console.log('\n🔸 Mode dry-run: SMS non envoyé');
    return;
  }

  // Send SMS
  console.log('\n📤 Envoi en cours...');
  try {
    await sendSMS(message);
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
