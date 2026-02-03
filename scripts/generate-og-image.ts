/**
 * Generate Open Graph image for social sharing
 * Creates a 1200x630 PNG image with Avactu branding
 */

import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = join(__dirname, '..', 'public', 'og-image.png');

// Design constants
const WIDTH = 1200;
const HEIGHT = 630;
const BG_COLOR = '#05070A'; // obsidian-950
const ACCENT_COLOR = '#6366f1'; // indigo-500

async function generateOgImage() {
  console.log('🎨 Generating Open Graph image...');

  // Create SVG with the design
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Gradient background -->
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0a0f1a"/>
          <stop offset="100%" style="stop-color:#05070A"/>
        </linearGradient>

        <!-- Glow effect -->
        <radialGradient id="glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" style="stop-color:${ACCENT_COLOR};stop-opacity:0.15"/>
          <stop offset="100%" style="stop-color:${ACCENT_COLOR};stop-opacity:0"/>
        </radialGradient>

        <!-- Grid pattern -->
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(148,163,184,0.05)" stroke-width="1"/>
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bg)"/>

      <!-- Grid overlay -->
      <rect width="100%" height="100%" fill="url(#grid)"/>

      <!-- Glow -->
      <rect width="100%" height="100%" fill="url(#glow)"/>

      <!-- Decorative circles -->
      <circle cx="100" cy="530" r="200" fill="none" stroke="rgba(99,102,241,0.1)" stroke-width="1"/>
      <circle cx="1100" cy="100" r="150" fill="none" stroke="rgba(99,102,241,0.08)" stroke-width="1"/>

      <!-- Logo - Globe mesh -->
      <g transform="translate(600, 200)">
        <!-- Outer glow -->
        <circle cx="0" cy="0" r="70" fill="rgba(14,165,233,0.08)"/>
        <circle cx="0" cy="0" r="55" fill="rgba(14,165,233,0.05)"/>

        <!-- Globe mesh lines -->
        <g stroke="#0ea5e9" fill="none" opacity="0.4">
          <ellipse cx="0" cy="0" rx="44" ry="44" stroke-width="1.5"/>
          <ellipse cx="0" cy="0" rx="44" ry="16" stroke-width="1"/>
          <ellipse cx="0" cy="0" rx="44" ry="16" stroke-width="1" transform="rotate(60)"/>
          <ellipse cx="0" cy="0" rx="44" ry="16" stroke-width="1" transform="rotate(-60)"/>
        </g>

        <!-- A structure lines -->
        <g stroke="#22d3ee" stroke-width="4" stroke-linecap="round">
          <line x1="0" y1="-32" x2="-28" y2="40"/>
          <line x1="0" y1="-32" x2="28" y2="40"/>
          <line x1="-18" y1="8" x2="18" y2="8"/>
        </g>

        <!-- Nodes -->
        <g fill="#22d3ee">
          <circle cx="-28" cy="40" r="5"/>
          <circle cx="28" cy="40" r="5"/>
          <circle cx="-18" cy="8" r="3.5"/>
          <circle cx="18" cy="8" r="3.5"/>
        </g>

        <!-- Heart at apex -->
        <g transform="translate(0, -38) scale(0.7)">
          <path d="M0 4 C -4 -2, -10 0, -10 6 C -10 12, 0 20, 0 20 C 0 20, 10 12, 10 6 C 10 0, 4 -2, 0 4 Z" fill="#f43f5e"/>
        </g>
      </g>

      <!-- Title -->
      <text x="600" y="380" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="#f8fafc" text-anchor="middle">AVACTU</text>

      <!-- Tagline -->
      <text x="600" y="440" font-family="Georgia, serif" font-size="28" fill="#94a3b8" text-anchor="middle">Toute l'actu Géopo en 10 minutes</text>

      <!-- Category badges -->
      <g transform="translate(600, 520)">
        <!-- Geopolitique -->
        <rect x="-290" y="-15" width="150" height="30" rx="15" fill="rgba(244,63,94,0.2)"/>
        <circle cx="-258" cy="0" r="4" fill="#f43f5e"/>
        <text x="-243" y="5" font-family="monospace" font-size="12" fill="#f43f5e">GEOPOLITIQUE</text>

        <!-- Economie -->
        <rect x="-80" y="-15" width="120" height="30" rx="15" fill="rgba(14,165,233,0.2)"/>
        <circle cx="-48" cy="0" r="4" fill="#0ea5e9"/>
        <text x="-33" y="5" font-family="monospace" font-size="12" fill="#0ea5e9">ECONOMIE</text>

        <!-- Politique -->
        <rect x="100" y="-15" width="120" height="30" rx="15" fill="rgba(139,92,246,0.2)"/>
        <circle cx="132" cy="0" r="4" fill="#8b5cf6"/>
        <text x="147" y="5" font-family="monospace" font-size="12" fill="#8b5cf6">POLITIQUE</text>
      </g>

      <!-- Bottom border accent -->
      <rect x="0" y="620" width="1200" height="10" fill="url(#bg)"/>
      <rect x="400" y="620" width="400" height="3" fill="${ACCENT_COLOR}" opacity="0.5"/>
    </svg>
  `;

  // Convert SVG to PNG
  await sharp(Buffer.from(svg))
    .png()
    .toFile(OUTPUT_PATH);

  console.log(`✅ Image saved to: ${OUTPUT_PATH}`);
}

generateOgImage().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
