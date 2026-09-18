/**
 * Client de synthèse avec bascule automatique vers Claude.
 *
 * Le fournisseur primaire peut être un endpoint Anthropic-compatible tiers
 * (Moonshot/Kimi via ANTHROPIC_BASE_URL). Si son compte est inutilisable
 * (solde épuisé, compte suspendu, clé révoquée), tous les appels restants du
 * run basculent sur l'API Anthropic. Incident d'origine : 2026-09-18, compte
 * Moonshot suspendu → 429 sur toutes les synthèses → édition vide.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { MODELS } from '../config/models.js';

type CreateParams = Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>;

export interface SynthesisClient {
  create(params: CreateParams, label: string): Promise<Anthropic.Message>;
  /** Message d'erreur du fournisseur primaire si la bascule a eu lieu, sinon null */
  fallbackReason(): string | null;
}

/**
 * Erreur de compte (pas transitoire) : inutile de réessayer sur ce fournisseur.
 * Moonshot renvoie un 429 pour un solde épuisé, d'où le test sur le message
 * pour le distinguer d'un vrai rate limit.
 */
export function isAccountError(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false;
  if (error.status === 401 || error.status === 402 || error.status === 403) return true;
  return (
    error.status === 429 &&
    /insufficient balance|suspended|exceeded_current_quota|billing/i.test(error.message)
  );
}

/**
 * Retry wrapper for Claude API calls with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 2, baseDelay = 2000, label = 'API call' } = {}
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error && (
        error.message.includes('rate_limit') ||
        error.message.includes('429') ||
        error.message.includes('overloaded')
      );
      const isRetryable = !isAccountError(error) &&
        (isRateLimit || (error instanceof Error && error.message.includes('timeout')));
      if (attempt < maxRetries && isRetryable) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`   ⚠ ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`${label} failed after ${maxRetries + 1} attempts`);
}

/**
 * @param primary  client du fournisseur configuré par l'environnement
 * @param fallback client Anthropic de secours, ou null si pas de bascule possible
 */
export function createSynthesisClient(
  primary: Anthropic,
  fallback: Anthropic | null,
  { baseDelay = 2000 } = {}
): SynthesisClient {
  let reason: string | null = null;

  return {
    fallbackReason: () => reason,
    async create(params, label) {
      if (!reason) {
        try {
          return await withRetry(
            () => primary.messages.create({ model: MODELS.synthesis, ...params }),
            { label, baseDelay }
          );
        } catch (error) {
          if (!fallback || !isAccountError(error)) throw error;
          reason = (error as Error).message.slice(0, 400);
          console.warn(`\n🔀 Compte ${MODELS.synthesis} inutilisable : ${reason}`);
          console.warn(`🔀 Bascule sur ${MODELS.synthesisFallback} pour le reste du run\n`);
        }
      }
      return withRetry(
        () => fallback!.messages.create({ model: MODELS.synthesisFallback, ...params }),
        { label: `${label} [fallback]`, baseDelay }
      );
    },
  };
}

/**
 * Construit le client depuis l'environnement. La bascule n'existe que si le
 * primaire est un endpoint tiers ET qu'une clé Anthropic est disponible.
 */
export function createSynthesisClientFromEnv(): SynthesisClient {
  const thirdParty = Boolean(process.env.ANTHROPIC_BASE_URL);
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const fallback = thirdParty && anthropicKey
    ? new Anthropic({ baseURL: 'https://api.anthropic.com', apiKey: anthropicKey, authToken: null })
    : null;
  return createSynthesisClient(new Anthropic(), fallback);
}

/**
 * Prévient l'admin par email qu'une bascule a eu lieu. Ne fait jamais échouer le pipeline.
 */
export async function notifyFallback(reason: string, storyCount: number): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('   ⚠ RESEND_API_KEY absente, alerte fallback non envoyée');
    return;
  }
  try {
    const { error } = await new Resend(resendApiKey).emails.send({
      from: 'Avactu <briefing@avactu.com>',
      to: 'jzakoian@gmail.com',
      subject: `Avactu : fallback ${MODELS.synthesis} → ${MODELS.synthesisFallback}`,
      text: [
        `La synthèse Avactu a basculé sur le modèle de secours.`,
        ``,
        `Modèle primaire : ${MODELS.synthesis} (${process.env.ANTHROPIC_BASE_URL})`,
        `Modèle de secours : ${MODELS.synthesisFallback}`,
        `Stories générées : ${storyCount}`,
        ``,
        `Erreur du fournisseur primaire :`,
        reason,
        ``,
        `Action : recharger ou vérifier le compte du fournisseur primaire.`,
      ].join('\n'),
    });
    if (error) {
      console.warn(`   ⚠ Alerte fallback non envoyée : ${error.message}`);
    } else {
      console.log('   📧 Alerte fallback envoyée');
    }
  } catch (error) {
    console.warn('   ⚠ Alerte fallback non envoyée :', error);
  }
}
