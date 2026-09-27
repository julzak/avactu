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
 *   ./node_modules/.bin/tsx scripts/diag-follow-up-pool.ts [eco|tech] [max_tokens] [full|none|titles|relevant] [default|off|<budget>]
 *
 * Historique : full = titres + bullets, titles = titres seuls, relevant = les 8 stories
 * les plus proches lexicalement du pool, none = pas de mode suivi.
 * Thinking : default = réglage du fournisseur, off = désactivé, <budget> = budget_tokens.
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
const thinking = process.argv[5] || 'default';

// synthesize.ts lance le pipeline à l'import : le prompt est lu dans le source
const source = readFileSync(join(ROOT, 'scripts', 'synthesize.ts'), 'utf-8');
const match = source.match(/const POOL_SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!match) throw new Error('POOL_SYSTEM_PROMPT introuvable dans synthesize.ts');
const system = match[1].replace(/%CATEGORY%/g, category);

interface Article { title: string; description: string; url: string; source: string; category: string }
const articles: Article[] = JSON.parse(readFileSync(join(ROOT, 'data', 'raw-articles.json'), 'utf-8')).articles
  .filter((a: Article) => a.category === category);
const sources = [...new Set(articles.map((a) => a.source))];

const words = (t: string) => new Set(
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
);
let recent = history === 'none' ? [] : await fetchRecentStories();
if (history === 'titles') recent = recent.map((s) => ({ ...s, bullets: [] }));
if (history === 'relevant') {
  const pool = words(articles.map((a) => `${a.title} ${a.description}`).join(' '));
  recent = recent
    .map((s) => {
      const w = [...words(`${s.title} ${s.bullets.join(' ')}`)];
      return { s, score: w.filter((x) => pool.has(x)).length / Math.max(w.length, 1) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.s);
  console.log(`[relevant] retenues : ${recent.map((s) => s.title).join(' | ')}`);
}
const block = buildFollowUpBlock(recent, 'pool');

const articlesDetail = articles
  .map((a, i) => `\nARTICLE ${i + 1} (${a.source}) :\nTitre: ${a.title}\nDescription: ${a.description}\nURL: ${a.url}\n`)
  .join('\n---\n');

const userPrompt = `Voici ${articles.length} articles de la catégorie "${category}" provenant de ${sources.length} sources (${sources.join(', ')}).

Identifie le sujet le plus important et synthétise-le.

${articlesDetail}${block}`;

const tag = `[${category} max=${maxTokens} hist=${history} think=${thinking}]`;
console.log(`${tag} modèle=${MODELS.synthesis} articles=${articles.length} historique=${recent.length} stories`);

const started = Date.now();
const response = await new Anthropic({ maxRetries: 0 }).messages.create({
  model: MODELS.synthesis,
  max_tokens: maxTokens,
  ...(thinking === 'default' ? {} : {
    thinking: thinking === 'off'
      ? { type: 'disabled' as const }
      : { type: 'enabled' as const, budget_tokens: Number(thinking) },
  }),
  system: [{ type: 'text', text: system }],
  messages: [{ role: 'user', content: userPrompt }],
});
const seconds = Math.round((Date.now() - started) / 1000);

console.log(`${tag} durée=${seconds}s stop_reason=${response.stop_reason} blocs=${response.content.map((b) => b.type).join(',')}`);
console.log(`${tag} prompt_chars=${userPrompt.length + system.length} bloc_suivi_chars=${block.length}`);
console.log(`${tag} usage=${JSON.stringify(response.usage)}`);
for (const b of response.content) {
  if (b.type === 'thinking') console.log(`${tag} thinking=${b.thinking.length} caractères, fin : …${b.thinking.slice(-600).replace(/\n+/g, ' ')}`);
  if (b.type === 'text') console.log(`${tag} text=\n${b.text}`);
}
