/**
 * Règles de catégorie appliquées après la synthèse d'un cluster.
 *
 * La catégorie d'un cluster vient du flux RSS de ses articles : les flux
 * généralistes (Courrier International, France 24, RFI) sont déclarés
 * "geopolitique" alors qu'ils charrient aussi de la culture. Le modèle de
 * synthèse propose la catégorie réelle ; ce module décide ce qu'on en fait.
 *
 * - "politique" (vie politique française) est un sous-type du créneau géopo.
 * - "culture" ne paraît que si le sujet est très repris : au moins
 *   CULTURE_MIN_SOURCES sources distinctes (décision Julien 2026-10-30,
 *   origine : mort de Patrick Stewart publiée en géopolitique).
 * - Toute autre reclassification est annulée (garde-fou de 2026-03-10 :
 *   la géopolitique reste dominante).
 */

export type ClusterCategory = 'geopolitique' | 'tech' | 'eco';
export type StoryCategory = ClusterCategory | 'politique' | 'culture';

export const CULTURE_MIN_SOURCES = 3;

export type CategoryDecision =
  | { action: 'keep'; category: StoryCategory; reverted: boolean }
  | { action: 'drop'; reason: string };

export function resolveStoryCategory(
  modelCategory: string | undefined,
  clusterCategory: ClusterCategory,
  sourceCount: number
): CategoryDecision {
  if (!modelCategory || modelCategory === clusterCategory) {
    return { action: 'keep', category: clusterCategory, reverted: false };
  }
  if (modelCategory === 'politique' && clusterCategory === 'geopolitique') {
    return { action: 'keep', category: 'politique', reverted: false };
  }
  if (modelCategory === 'culture') {
    if (sourceCount >= CULTURE_MIN_SOURCES) {
      return { action: 'keep', category: 'culture', reverted: false };
    }
    return {
      action: 'drop',
      reason: `sujet culturel repris par ${sourceCount} source(s), minimum ${CULTURE_MIN_SOURCES}`,
    };
  }
  return { action: 'keep', category: clusterCategory, reverted: true };
}
