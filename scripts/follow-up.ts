/**
 * Mode suivi : quand un thème domine l'actualité plusieurs jours de suite, la
 * synthèse ne doit couvrir que ce qui est nouveau depuis les stories déjà publiées.
 *
 * Constat d'origine (2026-09-27) : slot éco sur "Flambée des carburants" 13 éditions
 * d'affilée. L'ancien garde-fou (titres interdits) était inerte en CI : l'étape de
 * synthèse ne recevait pas SUPABASE_URL / SUPABASE_SERVICE_KEY et l'historique
 * revenait vide sans le moindre log.
 */

import { createClient } from '@supabase/supabase-js';

export interface RecentStory {
  date: string;
  category: string;
  title: string;
  bullets: string[];
}

export const FOLLOW_UP_DAYS = 7;

/**
 * Stories publiées sur les N derniers jours (table newsletter_editions), de la plus
 * récente à la plus ancienne. Ne fait jamais échouer le pipeline, mais ne se tait
 * jamais non plus : sans historique, le mode suivi est désactivé et ça doit se voir.
 */
export async function fetchRecentStories(days = FOLLOW_UP_DAYS): Promise<RecentStory[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY absentes : mode suivi désactivé');
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    // L'édition du jour est exclue : en cas de relance du pipeline après l'envoi,
    // elle serait sinon vue comme "déjà publiée" et tout serait sans nouveauté.
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('newsletter_editions')
      .select('edition_date, stories_json')
      .gte('edition_date', since)
      .lt('edition_date', today)
      .order('edition_date', { ascending: false });

    if (error || !data) {
      console.warn(`⚠️  Historique des éditions illisible : mode suivi désactivé (${error?.message ?? 'pas de données'})`);
      return [];
    }

    return data.flatMap((edition) => toRecentStories(edition.edition_date, edition.stories_json));
  } catch (error) {
    console.warn(`⚠️  Historique des éditions illisible : mode suivi désactivé (${error instanceof Error ? error.message : error})`);
    return [];
  }
}

export function toRecentStories(editionDate: string, storiesJson: unknown): RecentStory[] {
  if (!Array.isArray(storiesJson)) return [];
  return storiesJson
    .filter((s) => s && typeof s.title === 'string')
    .map((s) => ({
      date: String(editionDate).slice(0, 10),
      category: String(s.category ?? ''),
      title: s.title,
      bullets: Array.isArray(s.bullets) ? s.bullets.filter((b: unknown) => typeof b === 'string') : [],
    }));
}

/**
 * Bloc ajouté au prompt utilisateur. Chaîne vide sans historique : le prompt
 * reste alors strictement celui d'avant.
 *
 * @param mode 'cluster' : le sujet est imposé, le modèle peut répondre "rien_de_nouveau".
 *             'pool'    : le modèle choisit le sujet, il doit en prendre un autre.
 */
export function buildFollowUpBlock(recent: RecentStory[], mode: 'cluster' | 'pool'): string {
  if (recent.length === 0) return '';

  const published = recent
    .map((s) => `[${s.date}] ${s.title}\n${s.bullets.map((b) => `  - ${b}`).join('\n')}`)
    .join('\n');

  const noNews = mode === 'cluster'
    ? `- Si les articles n'apportent AUCUN fait nouveau substantiel par rapport à ces stories, ne synthétise pas et réponds uniquement :
{ "category": "rien_de_nouveau", "reason": "Explication courte", "relatedTitle": "Titre de la story déjà publiée" }`
    : `- Un sujet qui prolonge une story déjà publiée n'est éligible QUE s'il apporte un fait nouveau substantiel. Sinon, choisis un AUTRE sujet, même couvert par moins de sources.`;

  return `

MODE SUIVI (CRITIQUE) :
Les stories ci-dessous ont déjà été publiées ces ${FOLLOW_UP_DAYS} derniers jours. La lectrice les a lues.
- Un sujet qui dure peut être traité à nouveau, à condition de porter UNIQUEMENT sur ce qui est nouveau depuis : un fait daté, une décision, un chiffre, un acteur qui change de position.
- Le titre énonce le fait nouveau. INTERDIT de reprendre la formule d'un titre déjà publié en changeant seulement la fin.
- Aucun bullet ne répète une information déjà publiée.
- Dans l'execSummary, le rappel de ce qui a déjà été publié tient en une phrase maximum.
${noNews}

STORIES DÉJÀ PUBLIÉES :
${published}`;
}
