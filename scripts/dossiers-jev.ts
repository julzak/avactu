/**
 * Dossiers thématiques classés par Jev (TypeSafe), niveau 3 du classement des archives
 * (décision Julien 2026-11-11). Jugement structuré : passe par Jev, pas par un LLM.
 *
 * Une question Noul par dossier, toutes posées dans la même requête sur l'état du sujet
 * (titre, catégorie, lieu, points clés, analyse). Les probabilités brutes sont stockées
 * (table story_dossiers) ; le seuil d'appartenance vit dans config/dossiers.json et dans la
 * table dossiers, donc le changer ne demande aucun nouvel appel.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface DossierDef {
  slug: string;
  label: string;
  intro: string;
  relevant: string;
  not_relevant: string;
  /** Seuil propre au dossier, sinon le seuil global */
  threshold?: number;
}

export interface DossiersConfig {
  model: string;
  threshold: number;
  dossiers: DossierDef[];
}

export interface StoryForJev {
  id: string;
  title: string;
  category?: string;
  location?: { name?: string };
  bullets?: string[];
  execSummary?: string;
}

export interface JevResult {
  model: string;
  /** slug du dossier → probabilité que le sujet en relève */
  probabilities: Record<string, number>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = join(__dirname, '..', 'config', 'dossiers.json');
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export function loadDossiersConfig(path = CONFIG_PATH): DossiersConfig {
  const cfg = JSON.parse(readFileSync(path, 'utf-8')) as DossiersConfig;
  const slugs = new Set<string>();
  for (const d of cfg.dossiers) {
    if (!/^[a-z0-9-]+$/.test(d.slug) || slugs.has(d.slug)) throw new Error(`slug de dossier invalide ou en double : ${d.slug}`);
    slugs.add(d.slug);
  }
  return cfg;
}

export function thresholdOf(cfg: DossiersConfig, d: DossierDef): number {
  return d.threshold ?? cfg.threshold;
}

/** Catégories en clair pour Jev (les clés internes ne lui disent rien) */
const CATEGORY_LABEL: Record<string, string> = {
  geopolitique: 'géopolitique',
  politique: 'politique française',
  tech: 'tech et science',
  eco: 'économie',
  economie: 'économie',
  culture: 'culture et société',
};

export function stateOf(story: StoryForJev) {
  return {
    titre: story.title,
    rubrique: CATEGORY_LABEL[story.category ?? ''] ?? story.category ?? '',
    lieu: story.location?.name ?? '',
    points_cles: story.bullets ?? [],
    analyse: story.execSummary ?? '',
  };
}

export function questionsOf(dossiers: DossierDef[]) {
  return Object.fromEntries(
    dossiers.map((d) => [
      d.slug,
      {
        type: 'noul',
        instructions: `Ce sujet d'actualité (\`titre\`, \`points_cles\`, \`analyse\`) relève-t-il du dossier thématique « ${d.label} » d'un site d'actualité ? Un sujet peut relever de plusieurs dossiers.`,
        criteria: { true: d.relevant, false: d.not_relevant },
      },
    ])
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Un appel Jev pour un sujet, avec 3 relances sur erreur réseau, 429 ou 5xx */
export async function classifyStory(
  story: StoryForJev, dossiers: DossierDef[], apiKey: string, model = 'jev-latest'
): Promise<JevResult> {
  const body = JSON.stringify({ model, state: stateOf(story), questions: questionsOf(dossiers) });
  let lastError = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(2000 * attempt);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      if (!res.ok) {
        lastError = `HTTP ${res.status} ${text.slice(0, 200)}`;
        if (res.status === 429 || res.status >= 500) continue;
        break;
      }
      const json = JSON.parse(text) as { model: string; answers: Record<string, { noul?: number }> };
      const probabilities: Record<string, number> = {};
      for (const d of dossiers) {
        const p = json.answers?.[d.slug]?.noul;
        if (typeof p !== 'number' || p < 0 || p > 1) throw new Error(`réponse Jev sans probabilité pour ${d.slug}`);
        probabilities[d.slug] = p;
      }
      return { model: json.model, probabilities };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`Jev a échoué pour ${story.id} : ${lastError}`);
}

/** Exécute fn sur chaque élément avec au plus `limit` appels simultanés */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}
