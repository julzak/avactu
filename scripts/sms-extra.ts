/**
 * Ligne "mot du matin" du texto (décision Julien 2026-11-11).
 * - config/sms-notes.json : mot perso pour une date précise, prioritaire
 * - config/sms-phrases.json : banque de phrases, une par envoi, sans répétition
 *   avant d'avoir fait le tour (les textos partent les jours impairs)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHRASES_PATH = join(__dirname, '..', 'config', 'sms-phrases.json');
const NOTES_PATH = join(__dirname, '..', 'config', 'sms-notes.json');

/** Longueur max d'une phrase de la banque : au-delà le texto prend un segment de plus */
export const MAX_PHRASE_LENGTH = 50;

/** Début du décompte des envois pour la rotation */
const ROTATION_START = '2026-01-01';

// Alphabet GSM 03.38 de base (hors table d'extension). Un seul caractère hors de cet
// alphabet fait passer tout le SMS en Unicode : 70 caractères par segment au lieu de 160.
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

export function isGsm7(text: string): boolean {
  return [...text].every((c) => GSM7.includes(c));
}

/** Nombre de segments facturés pour un message */
export function smsSegments(text: string): number {
  const len = text.length;
  if (isGsm7(text)) return len <= 160 ? 1 : Math.ceil(len / 153);
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

/** Date (AAAA-MM-JJ) à Paris d'un instant ISO */
export function parisDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/** Nombre de jours impairs du mois entre ROTATION_START et `date` inclus */
function oddDaysUntil(date: string): number {
  let count = 0;
  const end = Date.parse(`${date}T00:00:00Z`);
  for (let t = Date.parse(`${ROTATION_START}T00:00:00Z`); t <= end; t += 86_400_000) {
    if (new Date(t).getUTCDate() % 2 === 1) count++;
  }
  return count;
}

export function pickPhrase(date: string, phrases: string[]): string | null {
  if (phrases.length === 0) return null;
  return phrases[oddDaysUntil(date) % phrases.length];
}

export function loadPhrases(): string[] {
  return JSON.parse(readFileSync(PHRASES_PATH, 'utf-8'));
}

export function loadNotes(): Record<string, string> {
  return JSON.parse(readFileSync(NOTES_PATH, 'utf-8'));
}

/** Mot du matin pour une date : mot perso s'il existe, sinon phrase de la banque */
export function getExtraLine(
  date: string,
  notes: Record<string, string> = loadNotes(),
  phrases: string[] = loadPhrases()
): { text: string; source: 'note' | 'banque' } | null {
  const note = notes[date]?.trim();
  if (note) return { text: note, source: 'note' };
  const phrase = pickPhrase(date, phrases);
  return phrase ? { text: phrase, source: 'banque' } : null;
}
