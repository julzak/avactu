/**
 * Régression : mot du matin dans le texto (décision Julien 2026-11-11).
 * Garde : la banque reste en GSM-7 et courte (sinon chaque texto coûte un segment de
 * plus), sans virgule (contrainte OVH), la rotation ne répète pas une phrase avant
 * d'avoir fait le tour, et le mot perso passe devant la banque.
 *
 * Usage: ./node_modules/.bin/tsx scripts/test-sms-extra.ts
 */

import {
  MAX_PHRASE_LENGTH, getExtraLine, isGsm7, loadNotes, loadPhrases, parisDate, pickPhrase, smsSegments,
} from './sms-extra.js';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures++;
}

console.log('--- Sanity check : les détecteurs voient bien ce qu\'ils gardent ---');
check('isGsm7 rejette ê / ç / ë / apostrophe typographique', ['fenêtre', 'ça', 'Israël', 'l’info'].every((s) => !isGsm7(s)));
check('isGsm7 accepte é è à ù', isGsm7('déjà là où règne l\'été'));
check('message du 2026-11-11 (99 car. avec "Israël") = 2 segments',
  smsSegments('Avactu du 11 novembre\nMadrid - Israël - Washington - Koléa - Santa - Paris\nLire: https://avactu.com') === 2);
check('160 car. GSM-7 = 1 segment, 161 = 2', smsSegments('a'.repeat(160)) === 1 && smsSegments('a'.repeat(161)) === 2);

console.log('--- Banque ---');
const phrases = loadPhrases();
check('au moins 30 phrases', phrases.length >= 30, `(${phrases.length})`);
check('pas de doublon', new Set(phrases).size === phrases.length);
for (const p of phrases) {
  const problems = [
    !isGsm7(p) && 'hors GSM-7',
    p.length > MAX_PHRASE_LENGTH && `${p.length} car.`,
    p.includes(',') && 'virgule',
  ].filter(Boolean);
  if (problems.length) check(`"${p}"`, false, `→ ${problems.join(', ')}`);
}
check('toutes les phrases : GSM-7, sans virgule, longueur max respectée', failures === 0);

console.log('--- Rotation ---');
// Tous les jours impairs sur 6 mois, y compris 31 → 1 (deux envois consécutifs)
const sendDays: string[] = [];
for (let t = Date.parse('2026-11-01T00:00:00Z'); t < Date.parse('2027-05-01T00:00:00Z'); t += 86_400_000) {
  const d = new Date(t);
  if (d.getUTCDate() % 2 === 1) sendDays.push(d.toISOString().slice(0, 10));
}
const picked = sendDays.map((d) => pickPhrase(d, phrases));
let repeatTooSoon = false;
for (let i = 0; i + phrases.length <= picked.length; i++) {
  if (new Set(picked.slice(i, i + phrases.length)).size !== phrases.length) repeatTooSoon = true;
}
check('aucune répétition sur une fenêtre de N envois', !repeatTooSoon);
check('31 décembre et 1er janvier : phrases différentes', pickPhrase('2026-12-31', phrases) !== pickPhrase('2027-01-01', phrases));

console.log('--- Mot perso ---');
check('le mot perso passe devant la banque',
  getExtraLine('2026-11-13', { '2026-11-13': 'Bon courage' }, phrases)?.source === 'note');
check('sans mot perso : banque', getExtraLine('2026-11-13', {}, phrases)?.source === 'banque');
check('mot perso vide ignoré', getExtraLine('2026-11-13', { '2026-11-13': '  ' }, phrases)?.source === 'banque');
check('config/sms-notes.json : aucune virgule dans les mots datés',
  Object.entries(loadNotes()).every(([k, v]) => k.startsWith('_') || !v.includes(',')));
check('parisDate : 23:30 UTC = lendemain à Paris', parisDate('2026-11-12T23:30:00Z') === '2026-11-13');

console.log(failures ? `\n❌ ${failures} échec(s)` : '\n✅ Tout passe');
process.exit(failures ? 1 : 0);
