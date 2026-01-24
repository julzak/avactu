/**
 * SMS Notification Script - Envoie les titres du jour à Ava via OVH SMS
 *
 * Usage:
 *   npm run send-sms           # Envoie le SMS
 *   npm run send-sms -- --dry-run  # Affiche le message sans l'envoyer
 */

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

interface OvhSmsResponse {
  totalCreditsRemoved: number;
  invalidReceivers: string[];
  ids: number[];
  validReceivers: string[];
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
    `Avactu du ${dateFormatted}`,
    '',
  ];

  for (const story of edition.stories) {
    const emoji = CATEGORY_EMOJI[story.category];
    const title = truncateTitle(story.title);
    lines.push(`${emoji} ${title}`);
  }

  lines.push('');
  lines.push(`${APP_URL}`);

  return lines.join('\n');
}

/**
 * Generate OVH API signature
 */
function generateSignature(
  appSecret: string,
  consumerKey: string,
  method: string,
  url: string,
  body: string,
  timestamp: number
): string {
  const crypto = require('crypto');
  const toSign = `${appSecret}+${consumerKey}+${method}+${url}+${body}+${timestamp}`;
  return '$1$' + crypto.createHash('sha1').update(toSign).digest('hex');
}

/**
 * Send SMS via OVH API
 */
async function sendSMS(message: string): Promise<void> {
  const appKey = process.env.OVH_APP_KEY;
  const appSecret = process.env.OVH_APP_SECRET;
  const consumerKey = process.env.OVH_CONSUMER_KEY;
  const serviceName = process.env.OVH_SMS_SERVICE;
  const toNumber = process.env.AVA_PHONE_NUMBER;

  if (!appKey || !appSecret || !consumerKey || !serviceName || !toNumber) {
    throw new Error(
      'Missing environment variables. Required: OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY, OVH_SMS_SERVICE, AVA_PHONE_NUMBER'
    );
  }

  const url = `https://eu.api.ovh.com/1.0/sms/${serviceName}/jobs`;
  const method = 'POST';
  const body = JSON.stringify({
    receivers: [toNumber],
    message: message,
    noStopClause: true,
    priority: 'high',
    sender: 'Avactu',
  });

  // Get OVH server time
  const timeResponse = await fetch('https://eu.api.ovh.com/1.0/auth/time');
  const timestamp = await timeResponse.json();

  // Generate signature
  const signature = generateSignature(appSecret, consumerKey, method, url, body, timestamp);

  // Send request
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ovh-Application': appKey,
      'X-Ovh-Consumer': consumerKey,
      'X-Ovh-Timestamp': String(timestamp),
      'X-Ovh-Signature': signature,
    },
    body: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OVH API error: ${response.status} - ${error}`);
  }

  const result: OvhSmsResponse = await response.json();

  console.log(`✅ SMS envoyé avec succès!`);
  console.log(`   ID: ${result.ids.join(', ')}`);
  console.log(`   Destinataires valides: ${result.validReceivers.join(', ')}`);
  console.log(`   Crédits utilisés: ${result.totalCreditsRemoved}`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('📱 AVACTU - Envoi SMS (OVH)');
  console.log('===========================');

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
