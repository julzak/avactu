/**
 * Régression : bascule du fournisseur de synthèse vers Claude (incident 2026-09-18)
 * et repli par requête sur refus du filtre de contenu (édition sans tech, 2026-09-27).
 * Deux serveurs HTTP locaux simulent le primaire (Moonshot) et le secours (Anthropic).
 *
 * Usage: ./node_modules/.bin/tsx scripts/test-synthesis-fallback.ts
 */

import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../config/models.js';
import { createSynthesisClient, isAccountError, isContentFilterError } from './synthesis-client.js';

// Corps exact renvoyé par Moonshot le 2026-09-18 (logs du run 35308505120)
const SUSPENDED = {
  status: 429,
  body: { error: { message: 'Your account org-xxx <ak-xxx> is suspended due to insufficient balance, please recharge your account or check your plan and billing details', type: 'exceeded_current_quota_error' } },
};
const RATE_LIMITED = {
  status: 429,
  body: { type: 'error', error: { type: 'rate_limit_error', message: 'Rate limit reached' } },
};
// Corps exact renvoyé par Moonshot le 2026-09-27 sur le pool tech (logs du run 36297113967)
const CONTENT_FILTERED = {
  status: 400,
  body: { error: { code: 400, message: 'The request was rejected because it was considered high risk', param: 'prompt', type: 'content_filter' } },
};
const BAD_REQUEST = {
  status: 400,
  body: { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: field required' } },
};
const okMessage = (model: string) => ({
  status: 200,
  body: { id: 'msg_test', type: 'message', role: 'assistant', model, content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
});

interface Fake { server: Server; url: string; models: string[]; reply: { status: number; body: unknown } }

async function fake(reply: Fake['reply']): Promise<Fake> {
  const f = { models: [], reply } as unknown as Fake;
  f.server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      f.models.push(JSON.parse(raw).model);
      res.writeHead(f.reply.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(f.reply.body));
    });
  });
  await new Promise<void>((r) => f.server.listen(0, '127.0.0.1', r));
  f.url = `http://127.0.0.1:${(f.server.address() as AddressInfo).port}`;
  return f;
}

const sdk = (f: Fake) => new Anthropic({ baseURL: f.url, apiKey: 'test', maxRetries: 0 });
const PARAMS = { max_tokens: 16, messages: [{ role: 'user' as const, content: 'ping' }] };

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const primary = await fake(SUSPENDED);
  const fallback = await fake(okMessage(MODELS.synthesisFallback));

  // 1. Sanity : sans secours, l'input bogué d'origine fait bien échouer l'appel
  const noFallback = createSynthesisClient(sdk(primary), null, { baseDelay: 1 });
  const originalError = await noFallback.create(PARAMS, 'sanity').then(() => null, (e) => e);
  check('sanity: compte suspendu sans secours → erreur', originalError !== null);
  check('sanity: erreur reconnue comme erreur de compte', isAccountError(originalError));
  check('sanity: pas de retry sur une erreur de compte', primary.models.length === 1, `appels=${primary.models.length}`);

  // 2. Compte suspendu + secours → bascule, et le reste du run ne touche plus le primaire
  primary.models.length = 0;
  const client = createSynthesisClient(sdk(primary), sdk(fallback), { baseDelay: 1 });
  const first = await client.create(PARAMS, 'first');
  const second = await client.create(PARAMS, 'second');
  check('bascule: réponse servie par le secours', first.model === MODELS.synthesisFallback && second.id === 'msg_test');
  check('bascule: secours appelé avec le modèle de secours', fallback.models.every((m) => m === MODELS.synthesisFallback) && fallback.models.length === 2);
  check('bascule: primaire sollicité une seule fois', primary.models.length === 1, `appels=${primary.models.length}`);
  check('bascule: raison exposée pour l\'alerte', /insufficient balance/.test(client.fallbackReason() ?? ''));

  // 3. Vrai rate limit → retries sur le primaire, jamais de bascule
  primary.reply = RATE_LIMITED;
  primary.models.length = 0;
  fallback.models.length = 0;
  const rateLimited = createSynthesisClient(sdk(primary), sdk(fallback), { baseDelay: 1 });
  const rlError = await rateLimited.create(PARAMS, 'ratelimit').then(() => null, (e) => e);
  check('rate limit: erreur remontée après retries', rlError !== null && primary.models.length === 3, `appels=${primary.models.length}`);
  check('rate limit: aucune bascule', fallback.models.length === 0 && rateLimited.fallbackReason() === null);

  // 4. Primaire sain → secours jamais sollicité
  primary.reply = okMessage(MODELS.synthesis);
  const healthy = createSynthesisClient(sdk(primary), sdk(fallback), { baseDelay: 1 });
  await healthy.create(PARAMS, 'healthy');
  check('primaire sain: aucune bascule', fallback.models.length === 0 && healthy.fallbackReason() === null);

  // 5. Sanity : sans secours, le refus du filtre de contenu fait bien échouer l'appel
  primary.reply = CONTENT_FILTERED;
  primary.models.length = 0;
  const filteredNoFallback = createSynthesisClient(sdk(primary), null, { baseDelay: 1 });
  const filterError = await filteredNoFallback.create(PARAMS, 'sanity filter').then(() => null, (e) => e);
  check('sanity: content_filter sans secours → erreur', filterError !== null);
  check('sanity: erreur reconnue comme filtre de contenu', isContentFilterError(filterError));
  check('sanity: un filtre de contenu n\'est pas une erreur de compte', !isAccountError(filterError));
  check('sanity: pas de retry sur un filtre de contenu', primary.models.length === 1, `appels=${primary.models.length}`);

  // 6. Filtre de contenu + secours → seule cette requête part sur le secours,
  //    la suivante revient sur le primaire (pas de bascule du run)
  primary.models.length = 0;
  const filtered = createSynthesisClient(sdk(primary), sdk(fallback), { baseDelay: 1 });
  const rejected = await filtered.create(PARAMS, 'pool tech').then((m) => m, () => null);
  check('filtre: requête rejetée servie par le secours', rejected?.model === MODELS.synthesisFallback, `model=${rejected?.model}`);
  check('filtre: secours appelé avec le modèle de secours', fallback.models.length === 1 && fallback.models[0] === MODELS.synthesisFallback);
  check('filtre: pas de bascule du run', filtered.fallbackReason() === null);
  primary.reply = okMessage(MODELS.synthesis);
  const next = await filtered.create(PARAMS, 'pool eco');
  check('filtre: requête suivante servie par le primaire', next.model === MODELS.synthesis && primary.models.length === 2 && fallback.models.length === 1, `primaire=${primary.models.length} secours=${fallback.models.length}`);

  // 7. Autre 400 (requête invalide) → erreur remontée, jamais de repli
  primary.reply = BAD_REQUEST;
  fallback.models.length = 0;
  const invalid = createSynthesisClient(sdk(primary), sdk(fallback), { baseDelay: 1 });
  const badError = await invalid.create(PARAMS, 'bad request').then(() => null, (e) => e);
  check('400 générique: erreur remontée sans repli', badError !== null && !isContentFilterError(badError) && fallback.models.length === 0);

  primary.server.close();
  fallback.server.close();
  if (failures > 0) {
    console.error(`\n❌ ${failures} échec(s)`);
    process.exit(1);
  }
  console.log('\n✅ Tous les tests passent');
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
