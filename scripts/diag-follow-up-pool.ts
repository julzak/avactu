/**
 * Diagnostic : rejoue l'appel de synthèse "pool" d'une catégorie avec le mode suivi,
 * et affiche ce que les logs du pipeline ne montrent pas (stop_reason, tokens, durée).
 * N'écrit aucun fichier, n'envoie rien.
 *
 * Origine : run 36305957430 (2026-09-27), slot éco en échec deux fois de suite
 * avec "No text block in response".
 *
 * Usage :
 *   set -a; source .env.local; set +a
 *   ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic \
 *   ANTHROPIC_AUTH_TOKEN=$(cat ~/.config/moonshot/key) SYNTHESIS_MODEL=kimi-k3 \
 *   ./node_modules/.bin/tsx scripts/diag-follow-up-pool.ts [eco|tech] [max_tokens] [full|none]
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MODELS } from '../config/models.js';
import { buildFollowUpBlock, fetchRecentStories } from './follow-up.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const category = process.argv[2] || 'eco';
const maxTokens = Number(process.argv[3] || 8192);
const history = process.argv[4] || 'full';

// synthesize.ts lance le pipeline à l'import : le prompt est lu dans le source
const source = readFileSync(join(ROOT, 'scripts', 'synthesize.ts'), 'utf-8');
const match = source.match(/const POOL_SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!match) throw new Error('POOL_SYSTEM_PROMPT introuvable dans synthesize.ts');
const system = match[1].replace(/%CATEGORY%/g, category);

interface Article { title: string; description: string; url: string; source: string; category: string }
const articles: Article[] = JSON.parse(readFileSync(join(ROOT, 'data', 'raw-articles.json'), 'utf-8')).articles
  .filter((a: Article) => a.category === category);
const sources = [...new Set(articles.map((a) => a.source))];

const recent = history === 'none' ? [] : await fetchRecentStories();
const block = buildFollowUpBlock(recent, 'pool');

const articlesDetail = articles
  .map((a, i) => `\nARTICLE ${i + 1} (${a.source}) :\nTitre: ${a.title}\nDescription: ${a.description}\nURL: ${a.url}\n`)
  .join('\n---\n');

const userPrompt = `Voici ${articles.length} articles de la catégorie "${category}" provenant de ${sources.length} sources (${sources.join(', ')}).

Identifie le sujet le plus important et synthétise-le.

${articlesDetail}${block}`;

const tag = `[${category} max=${maxTokens} hist=${history}]`;
console.log(`${tag} modèle=${MODELS.synthesis} articles=${articles.length} historique=${recent.length} stories`);

const started = Date.now();
const response = await new Anthropic({ maxRetries: 0 }).messages.create({
  model: MODELS.synthesis,
  max_tokens: maxTokens,
  system: [{ type: 'text', text: system }],
  messages: [{ role: 'user', content: userPrompt }],
});
const seconds = Math.round((Date.now() - started) / 1000);

console.log(`${tag} durée=${seconds}s stop_reason=${response.stop_reason} blocs=${response.content.map((b) => b.type).join(',')}`);
console.log(`${tag} usage=${JSON.stringify(response.usage)}`);
for (const b of response.content) {
  if (b.type === 'thinking') console.log(`${tag} thinking=${b.thinking.length} caractères, fin : …${b.thinking.slice(-600).replace(/\n+/g, ' ')}`);
  if (b.type === 'text') console.log(`${tag} text=\n${b.text}`);
}
