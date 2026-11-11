# checks : dossiers thématiques classés par Jev (2026-11-11)

Méthode : auto-vérification par la session qui a construit (pas de relecture `evidence-reviewer` : outil interne, pas d'envoi à un tiers). Les étiquettes du jeu de contrôle ont été posées par Claude, pas par Julien.

## Score sur le jeu de contrôle (`data/dossiers-gold.json`, 115 sujets)

Commande : `npm run eval-dossiers -- --cached` (réponses brutes dans `data/dossiers-gold-answers.json`, jev-1.14.0).

| Essai | Changement | F1 micro | Précision | Rappel | Décision |
|---|---|---|---|---|---|
| Référence | descriptions initiales, seuil 0.5 | 0.868 | 77 % (79 VP, 24 FP) | 100 % | point de départ |
| 1 | seuil global 0.5 → 0.7 (balayage 0.1 à 0.9 : maximum à 0.7, 0.8 égal mais perd 3 VP) | 0.969 | 94 % (5 FP) | 100 % | gardé |
| 2 | Chine : « une catastrophe naturelle en Chine sans enjeu politique » exclue | 0.981 | 96 % (3 FP) | 100 % | gardé |

Score retenu, par dossier au seuil 0.7 :

| Dossier | Positifs | Précision | Rappel | F1 |
|---|---|---|---|---|
| Guerre en Ukraine | 9 | 90 % | 100 % | 0.95 |
| Iran et détroit d'Ormuz | 11 | 100 % | 100 % | 1.00 |
| Israël, Gaza et Liban | 10 | 100 % | 100 % | 1.00 |
| Politique américaine | 6 | 86 % | 100 % | 0.92 |
| Présidentielle française | 7 | 100 % | 100 % | 1.00 |
| Intelligence artificielle | 11 | 100 % | 100 % | 1.00 |
| Énergie et carburants | 13 | 100 % | 100 % | 1.00 |
| Climat et environnement | 8 | 89 % | 100 % | 0.94 |
| Chine | 4 | 100 % | 100 % | 1.00 |

Faux positifs restants : sommet de l'OTAN à Ankara classé Ukraine (0.76), frappes US sur l'Iran classées Politique américaine (0.74), centrale à gaz d'Amazon classée Climat (0.83). Les trois sont discutables.

Limites du score, à garder en tête :
- 55 sujets sur 115 ont été choisis par mots-clés du titre pour garantir des positifs : ces positifs sont plutôt faciles, le rappel réel sur l'historique est sans doute inférieur à 100 %.
- Petits effectifs (Chine 4 positifs, Politique américaine 6) : un sujet de plus ou de moins bouge le score de 10 à 20 points.
- 18 couples (sujet, dossier) jugés limites sont exclus du score (`null` dans le fichier), dont 7 en Politique américaine.
- Le réglage s'est arrêté après 2 essais pour ne pas sur-ajuster sur 115 sujets.

## Exigences

| Exigence | Verdict | Preuve | Correction |
|---|---|---|---|
| `config/dossiers.json` : liste + description (ce qui relève, ce qui ne relève pas) | pass, liste non validée par Julien | 9 dossiers, champs `relevant` / `not_relevant` | Israël : vie politique israélienne ajoutée avant la mesure de référence |
| Jeu de contrôle figé ~100 sujets, score de référence avant réglage | pass | 115 sujets, référence F1 0.868 mesurée avant tout réglage | |
| Seuil réglé sur le jeu, pas deviné | pass | balayage du seuil dans `scripts/eval-dossiers.ts`, 0.7 retenu | |
| 1 467 sujets historiques classés en base | pass | `story_dossiers` : 13 203 lignes (1 467 × 9), relance `--all` : « 0 à classer » | plafond PostgREST de 1 000 lignes dans la lecture des couples déjà classés : 623 sujets reclassés au 2e passage, corrigé (paquets de 100 sujets) |
| Pipeline : classement après la synthèse, non bloquant, avertissement, rattrapage | pass en code, non résolu en CI | étape `Classify stories into dossiers` (`continue-on-error`, `::warning`), script relancé sur 14 jours | à confirmer au premier run du matin après merge |
| Pages `/dossier/:slug` paginées | pass (confirmé en production) | handler local contre la vraie base : Ukraine p1 100 sujets, p2 74, p3 404, slug inconnu 404 | |
| Liens depuis chaque sujet et depuis `/archives` | pass en local | `/s/2026-08-24-03` → Présidentielle française ; `/edition/2026-07-14` : 3 sujets liés ; `/archives` : 9 dossiers | |
| Sitemap, denylist du service worker | pass | 9 URL `/dossier/` dans le sitemap local ; `/^\/dossier\//` dans `dist/sw.js` | |
| Tests, build | pass | `scripts/test-archive-render.ts` (9 nouveaux checks), `npm run build`, `tsc` strict sur API et scripts, ESLint | |

Effectifs au seuil 0.7 sur l'historique : Ukraine 174, Iran et Ormuz 218, Israël Gaza Liban 103, Politique américaine 204, Présidentielle 10, IA 153, Énergie 156, Climat 49, Chine 55. Présidentielle : seulement une dizaine de sujets français sur la campagne dans le corpus (les autres « présidentielles » sont étrangères, à 0.01-0.03).

## Contrôle en production (avactu.com, 2026-11-11, après merge de julzak/avactu#31)

| URL | HTTP | Constat |
|---|---|---|
| `/dossier/guerre-en-ukraine` | 200 | « Guerre en Ukraine : le dossier », 100 sujets |
| `/dossier/guerre-en-ukraine/2` | 200 | 74 sujets |
| `/dossier/guerre-en-ukraine/3` | 404 | page introuvable |
| `/dossier/inconnu` | 404 | page introuvable |
| `/dossier/presidentielle-francaise` | 200 | 10 sujets |
| `/dossier/chine` | 200 | 55 sujets |
| `/archives` | 200 | section « Les dossiers », 9 liens |
| `/s/2026-08-24-03` | 200 | lien vers Présidentielle française |
| `/edition/2026-07-14` | 200 | 4 dossiers liés depuis ses sujets |
| `/sitemap.xml` | 200 | 9 URL `/dossier/` |

Non résolu : le classement par le pipeline du matin n'a pas encore tourné en CI (premier run attendu le 2026-11-12 vers 07:00 Paris). À vérifier : log de l'étape `Classify stories into dossiers` et sujets du jour présents dans `story_dossiers`.

## Suites (non faites)

- Faire valider la liste des 9 dossiers par Julien ; en ajouter un = l'écrire dans `config/dossiers.json`, l'étiqueter dans le jeu de contrôle, puis `npm run classify-dossiers -- --all --only=<slug>`.
- Faire relire par Julien les étiquettes du jeu de contrôle (posées par Claude), surtout les 18 cas limites.
- Renforcer le jeu de contrôle en Chine et Politique américaine (4 et 6 positifs) avant tout nouveau réglage.
- Si `jev-latest` change de version (aujourd'hui jev-1.14.0), relancer `npm run eval-dossiers` et comparer au score ci-dessus.
