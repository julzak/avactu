/**
 * SMS Notification Script - Envoie les titres du jour via OVH SMS HTTP2SMS API
 *
 * Usage:
 *   npm run send-sms              # Envoie le SMS à Ava et Félix
 *   npm run send-sms -- --dry-run # Affiche le message sans l'envoyer
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

// OVH SMS API endpoint
const OVH_SMS_API = 'https://www.ovh.com/cgi-bin/sms/http2sms.cgi';

/**
 * Convert phone number from +33 format to 0033 format (OVH requirement)
 */
function convertToOvhFormat(phone: string): string {
  // Remove spaces and dashes
  let cleaned = phone.replace(/[\s-]/g, '');

  // Convert +33 to 0033
  if (cleaned.startsWith('+33')) {
    cleaned = '0033' + cleaned.slice(3);
  }
  // Convert +XX to 00XX for other countries
  else if (cleaned.startsWith('+')) {
    cleaned = '00' + cleaned.slice(1);
  }

  return cleaned;
}

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
  ];

  for (const story of edition.stories) {
    const emoji = CATEGORY_EMOJI[story.category];
    const title = truncateTitle(story.title);
    lines.push(`${emoji} ${title}`);
  }

  lines.push(`👉 ${APP_URL}`);

  return lines.join('\n');
}

/**
 * Send SMS via OVH HTTP2SMS API
 */
async function sendSMS(message: string, phoneNumber: string, recipientName: string): Promise<boolean> {
  const account = process.env.OVH_SMS_SERVICE;
  const login = process.env.OVH_SMS_LOGIN;
  const password = process.env.OVH_SMS_PASSWORD;
  const sender = process.env.OVH_SMS_SENDER;

  if (!account || !login || !password) {
    throw new Error(
      'Missing environment variables. Required: OVH_SMS_SERVICE, OVH_SMS_LOGIN, OVH_SMS_PASSWORD'
    );
  }

  const toNumber = convertToOvhFormat(phoneNumber);

  // Build query string
  const params = new URLSearchParams({
    account: account,
    login: login,
    password: password,
    to: toNumber,
    message: message,
    noStop: '1',
  });

  // Add sender if configured
  if (sender) {
    params.set('from', convertToOvhFormat(sender));
  }

  const url = `${OVH_SMS_API}?${params.toString()}`;

  console.log(`\n📤 Envoi à ${recipientName} (${phoneNumber})...`);

  try {
    const response = await fetch(url);
    const result = await response.text();

    // OVH returns "OK" on success, or an error message
    if (result.trim().startsWith('OK')) {
      console.log(`   ✅ SMS envoyé avec succès à ${recipientName}`);
      return true;
    } else {
      console.error(`   ❌ Erreur OVH pour ${recipientName}: ${result}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Erreur réseau pour ${recipientName}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('📱 AVACTU - Envoi SMS (OVH HTTP2SMS)');
  console.log('====================================');

  // Load stories
  let edition: Edition;
  try {
    const content = readFileSync(STORIES_PATH, 'utf-8');
    edition = JSON.parse(content);
  } catch (error) {
    console.error('❌ Erreur: Impossible de lire stories.json');
    console.error("   Exécutez d'abord: npm run curate && npm run synthesize");
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

    // Show what would be sent
    const avaPhone = process.env.AVA_PHONE_NUMBER || '(non configuré)';
    const felixPhone = process.env.FELIX_PHONE_NUMBER || '(non configuré)';

    console.log('\n📋 Destinataires:');
    console.log(`   - Ava: ${avaPhone} → ${avaPhone !== '(non configuré)' ? convertToOvhFormat(avaPhone) : '-'}`);
    console.log(`   - Félix: ${felixPhone} → ${felixPhone !== '(non configuré)' ? convertToOvhFormat(felixPhone) : '-'}`);
    return;
  }

  // Get phone numbers
  const avaPhone = process.env.AVA_PHONE_NUMBER;
  const felixPhone = process.env.FELIX_PHONE_NUMBER;

  if (!avaPhone && !felixPhone) {
    console.error('❌ Erreur: Aucun numéro de téléphone configuré');
    console.error('   Définissez AVA_PHONE_NUMBER et/ou FELIX_PHONE_NUMBER');
    process.exit(1);
  }

  // Send SMS to both recipients
  let successCount = 0;
  let totalCount = 0;

  if (avaPhone) {
    totalCount++;
    if (await sendSMS(message, avaPhone, 'Ava')) {
      successCount++;
    }
  }

  if (felixPhone) {
    totalCount++;
    if (await sendSMS(message, felixPhone, 'Félix')) {
      successCount++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(40));
  if (successCount === totalCount) {
    console.log(`✅ ${successCount}/${totalCount} SMS envoyés avec succès`);
  } else {
    console.log(`⚠️  ${successCount}/${totalCount} SMS envoyés`);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
