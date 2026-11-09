# TODO

## Synthèse : suites du mode suivi (PR #16, 2026-09-27)

- [ ] **Journaliser durée et tokens de chaque appel de synthèse réussi.** Aujourd'hui seul l'échec affiche `stop_reason` et `output_tokens`. Run 36307704199 : l'appel Ukraine a duré 9 min, proche du timeout de 10 min du SDK, sans qu'on sache combien de tokens il a consommé sur les 16 384 autorisés.
- [ ] **Sortir les vérifications mécaniques du prompt.** Le modèle passe une partie de son thinking à compter les caractères du titre et les mots des bullets. Les faire dans le code (longueur du titre, nombre de mots) et retirer ces comptages du prompt. Mesurer avant et après avec `scripts/diag-follow-up-pool.ts`.
- [ ] **Paralléliser les synthèses géopo (2 appels simultanés maximum).** Gain attendu d'environ 7 min par run, tokens inchangés. Attention : 2 appels sur 5 en timeout lors d'un test à 5 appels simultanés sur Moonshot (2026-09-27).
- [ ] **Évaluer l'historique en titres seuls.** Un essai unique : 6 188 tokens de sortie contre ~7 800 avec les bullets. À confirmer sur plusieurs runs, en vérifiant que le jugement "fait nouveau ou pas" ne se dégrade pas.
- [ ] **`withRetry` ne relance pas les timeouts du SDK.** Il teste `message.includes('timeout')` alors que le SDK renvoie "Request timed out." (`scripts/synthesis-client.ts`). Défaut préexistant, vu pendant les tests.

## Déclencheur externe du workflow quotidien (2026-09-29, terminé le 2026-11-09)
- [x] Merger julzak/avactu#19 (garde-fou anti-doublon, entrée trigger_source)
- [x] Créer un jeton GitHub fine-grained (julzak/avactu, Actions: Read and write)
- [x] Installer le timer sur le VPS Scaleway (`avactu-trigger.timer`, 05:00 Europe/Paris), testé le 2026-11-09 : HTTP 204, run `Daily edition (vps)` arrêté par le garde-fou comme attendu
- [ ] Créer le check healthchecks.io `avactu-trigger` (quotidien 05:00 Europe/Paris, grâce 1 h) et mettre son URL dans `/opt/avactu-trigger/.env` (`HEALTHCHECK_URL=...`) : pas de clé API pour le faire par script
- [ ] Renouveler le jeton GitHub avant son expiration (1 an, vers le 2027-11-09), sinon seul le cron de secours tourne et l'envoi redérive
