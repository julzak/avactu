# TODO

## Synthèse : suites du mode suivi (PR #16, 2026-09-27)

- [ ] **Journaliser durée et tokens de chaque appel de synthèse réussi.** Aujourd'hui seul l'échec affiche `stop_reason` et `output_tokens`. Run 36307704199 : l'appel Ukraine a duré 9 min, proche du timeout de 10 min du SDK, sans qu'on sache combien de tokens il a consommé sur les 16 384 autorisés.
- [ ] **Sortir les vérifications mécaniques du prompt.** Le modèle passe une partie de son thinking à compter les caractères du titre et les mots des bullets. Les faire dans le code (longueur du titre, nombre de mots) et retirer ces comptages du prompt. Mesurer avant et après avec `scripts/diag-follow-up-pool.ts`.
- [ ] **Paralléliser les synthèses géopo (2 appels simultanés maximum).** Gain attendu d'environ 7 min par run, tokens inchangés. Attention : 2 appels sur 5 en timeout lors d'un test à 5 appels simultanés sur Moonshot (2026-09-27).
- [ ] **Évaluer l'historique en titres seuls.** Un essai unique : 6 188 tokens de sortie contre ~7 800 avec les bullets. À confirmer sur plusieurs runs, en vérifiant que le jugement "fait nouveau ou pas" ne se dégrade pas.
- [ ] **`withRetry` ne relance pas les timeouts du SDK.** Il teste `message.includes('timeout')` alors que le SDK renvoie "Request timed out." (`scripts/synthesis-client.ts`). Défaut préexistant, vu pendant les tests.
