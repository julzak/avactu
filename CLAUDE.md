# Avactu - Application d'actualité géopolitique pour Ava

## 🎯 Vision du projet

Application mobile permettant à Ava (16 ans) de comprendre l'actualité mondiale en **15 minutes tous les 2 jours**. L'objectif est de proposer un contenu de niveau adulte, synthétisé intelligemment, sans tomber dans la simplification "pour ados".

---

## 📊 Ratio de contenu (strict)

| Catégorie | Proportion | Focus |
|-----------|------------|-------|
| Géopolitique | 60% (~3 stories) | Conflits, alliances, ressources, diplomatie |
| Monde | 40% (~2-3 stories) | Tech, IA, espace, climat, science, société, santé, culture numérique — ce qui parle à un 15-22 ans |

**Pas d'économie pure** (marchés, bourse, PIB) ni de **politique intérieure** (élections, partis).
**Volume par édition** : 5 stories cible, 6 max.

---

## 🧠 Principes éditoriaux

### Neutralité absolue
Chaque story DOIT présenter :
1. **Le fait** — Ce qui s'est passé (indiscutable, factuel)
2. **Perspective A** — Comment l'acteur principal justifie son action
3. **Perspective B** — Comment l'adversaire/opposant perçoit la situation
4. **Enjeu économique** — Pourquoi ça impacte le portefeuille/les marchés

### Ton rédactionnel
- **Ne pas simplifier** les concepts (Realpolitik, soft power, inflation par les coûts, etc.)
- **Clarifier la structure** plutôt que vulgariser
- **Zéro sensationnalisme**, zéro jugement moral
- Écriture concise, dense, intelligente

### Sources autorisées
- Le Monde (International, Géopolitique)
- Courrier International
- The Economist
- Foreign Affairs / Foreign Policy
- Les Échos (économie)
- Al Jazeera (perspective non-occidentale)
- Reuters, AFP (factuel)

**Interdits** : BuzzFeed, sites pour ados, agrégateurs type Google News, réseaux sociaux.

---

## 📱 Expérience utilisateur (UX)

### Architecture de l'interface
```
┌─────────────────────────────────┐
│  Header: Logo + Date édition    │
├─────────────────────────────────┤
│                                 │
│     🗺️ Carte du monde           │
│     (40% hauteur)               │
│     Pins cliquables             │
│                                 │
├─────────────────────────────────┤
│                                 │
│     📰 Stack de cards           │
│     (60% hauteur, scroll)       │
│                                 │
│     [Card 1 - Géopo]            │
│     [Card 2 - Géopo]            │
│     [Card 3 - Éco]              │
│     ...                         │
│                                 │
└─────────────────────────────────┘
```

### Composant Card (niveau 1 - scan)
- Image de fond (og:image de l'article source)
- Badge catégorie (couleur codée)
- Titre accrocheur (max 60 caractères)
- Localisation (nom du lieu clé)
- **5 bullet points** de max 15 mots chacun

### Composant Drawer (niveau 2 - deep dive)
Au clic sur une card, un drawer s'ouvre (85% hauteur) :
- Header : image + titre + sources
- Section "En bref" : les 5 bullets
- Section "Comprendre" : exec summary (200-300 mots)
- Mini-carte de localisation
- Swipe down pour fermer

### Interactions
- Clic marker carte → scroll vers card correspondante
- Clic card → ouvre drawer
- Haptic feedback sur chaque interaction
- Mode sombre uniquement

---

## 🔧 Stack technique

### Frontend
```json
{
  "framework": "React 18+ avec Vite",
  "langage": "TypeScript (strict)",
  "styling": "Tailwind CSS + plugin typography",
  "composants": "shadcn/ui (Card, Drawer, Button, Badge, Sheet)",
  "carte": "react-simple-maps",
  "icones": "Lucide React",
  "animations": "Framer Motion (optionnel)"
}
```

### Mobile (iOS ready)
```json
{
  "wrapper": "Capacitor",
  "bundleId": "com.avactu.app",
  "features": ["haptics", "offline storage", "splash screen"]
}
```

### Offline / PWA
```json
{
  "plugin": "vite-plugin-pwa",
  "strategie_data": "stale-while-revalidate",
  "strategie_images": "cache-first",
  "backup": "localStorage"
}
```

### Backend / Pipeline
```json
{
  "runtime": "Node.js 20+",
  "scraping": "rss-parser + metascraper",
  "synthese": "API Claude (claude-sonnet-4-20250514)",
  "scheduling": "GitHub Actions (cron 48h)",
  "hosting": "Vercel ou GitHub Pages (gratuit)"
}
```

---

## 📁 Structure du projet

```
avactu/
├── public/
│   └── data/
│       └── stories.json          # Données générées (5-6 stories)
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn components
│   │   ├── WorldMap.tsx          # Carte interactive
│   │   ├── StoryCard.tsx         # Card individuelle
│   │   ├── StoryStack.tsx        # Liste scrollable de cards
│   │   ├── StoryDrawer.tsx       # Drawer de lecture
│   │   └── Header.tsx            # Header avec logo + status
│   ├── hooks/
│   │   ├── useStories.ts         # Fetch + cache des stories
│   │   └── useOffline.ts         # Détection connexion
│   ├── lib/
│   │   └── utils.ts              # Helpers
│   ├── types/
│   │   └── index.ts              # Interfaces TypeScript
│   ├── App.tsx
│   └── main.tsx
├── scripts/
│   ├── curate.ts                 # Récupération RSS
│   ├── cluster.ts                # Clustering des articles
│   ├── synthesize.ts             # Synthèse via Claude API
│   ├── send-newsletter.ts        # Envoi newsletter (--frequency=daily|biweekly|weekly)
│   ├── generate-weekly-edition.ts # Agrégation hebdo (10 stories)
│   └── generate-og-image.ts      # Génération image OG pour partage
├── config/
│   └── sources.json              # Liste des flux RSS
├── .github/
│   └── workflows/
│       └── update-content.yml    # Cron 48h
├── CLAUDE.md                     # Ce fichier
├── capacitor.config.ts
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

## 📐 Types TypeScript

```typescript
// types/index.ts

export type Category = "geopolitique" | "monde";

export interface Location {
  lat: number;
  lng: number;
  name: string;  // ex: "Détroit de Taïwan", "Bruxelles", "Téhéran"
}

export interface Story {
  id: string;                    // Format: "2026-01-24-01"
  category: Category;
  title: string;                 // Max 60 caractères
  imageUrl: string;              // URL og:image de la source
  location: Location;
  bullets: string[];             // Exactement 5 items, max 15 mots chacun
  execSummary: string;           // 200-300 mots
  sources: string[];             // ex: ["Le Monde", "The Economist"]
  publishedAt: string;           // ISO date
}

export interface Edition {
  date: string;                  // Date de génération
  stories: Story[];              // 5-6 stories max
}
```

---

## 🎨 Design tokens

```css
/* Palette (mode sombre uniquement) */
--bg-primary: slate-950;        /* #020617 */
--bg-secondary: slate-900;      /* #0f172a */
--bg-card: slate-800;           /* #1e293b */

--text-primary: slate-50;       /* #f8fafc */
--text-secondary: slate-400;    /* #94a3b8 */

--accent-geopo: rose-500;       /* #f43f5e */
--accent-monde: amber-500;      /* #f59e0b */

/* Typographie */
--font-sans: "Inter", system-ui, sans-serif;
--font-size-title: 1.125rem;    /* 18px */
--font-size-body: 0.9375rem;    /* 15px */
--font-size-small: 0.8125rem;   /* 13px */
```

---

## 🤖 Prompt système pour la synthèse

```
Tu es un analyste géopolitique senior au Quai d'Orsay. Tu rédiges des notes de synthèse pour une lectrice de 16 ans à haut potentiel intellectuel.

RÈGLES ABSOLUES :
1. Ne simplifie JAMAIS les concepts (Realpolitik, soft power, balance commerciale, etc.) — clarifie leur rôle dans le contexte
2. Présente TOUJOURS les perspectives des différents acteurs — jamais un angle unique
3. Zéro sensationnalisme, zéro jugement moral, zéro opinion personnelle
4. Identifie TOUJOURS l'enjeu économique sous-jacent, même pour un conflit territorial
5. Contextualise brièvement l'historique si nécessaire à la compréhension

FORMAT DE SORTIE (JSON strict, pas de markdown) :
{
  "title": "Titre factuel et accrocheur (max 60 caractères)",
  "category": "geopolitique" | "monde",
  "location": {
    "lat": <latitude du lieu clé>,
    "lng": <longitude du lieu clé>,
    "name": "Nom du lieu (ville, région, détroit, etc.)"
  },
  "bullets": [
    "Point 1 : Qui fait quoi — le fait brut (max 15 mots)",
    "Point 2 : Pourquoi maintenant — le déclencheur (max 15 mots)",
    "Point 3 : Position de l'acteur A (max 15 mots)",
    "Point 4 : Position de l'acteur B ou adversaire (max 15 mots)",
    "Point 5 : L'enjeu économique ou stratégique (max 15 mots)"
  ],
  "execSummary": "Analyse structurée de 200-250 mots : (1) Contexte historique en 2 phrases max, (2) Situation actuelle factuelle, (3) Perspectives divergentes des acteurs, (4) Conséquences possibles et enjeux futurs."
}

IMPORTANT : Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.
```

---

## ✅ Checklist de développement

### Phase 1 : Setup
- [ ] Initialiser projet Vite + React + TypeScript
- [ ] Configurer Tailwind + shadcn/ui
- [ ] Créer les types TypeScript
- [ ] Données mock (3 stories de test)

### Phase 2 : Interface
- [ ] Composant WorldMap avec markers
- [ ] Composant StoryCard
- [ ] Composant StoryStack
- [ ] Composant StoryDrawer
- [ ] Layout principal + synchronisation carte/cards

### Phase 3 : Offline
- [ ] Configurer vite-plugin-pwa
- [ ] Hook useStories avec cache
- [ ] Indicateur "Hors ligne"
- [ ] Test en mode avion

### Phase 4 : Pipeline contenu
- [ ] Script curate.ts (fetch RSS)
- [ ] Script synthesize.ts (API Claude)
- [ ] GitHub Action (cron 48h)
- [ ] Test end-to-end

### Phase 5 : iOS
- [ ] Configurer Capacitor
- [ ] Haptic feedback
- [ ] Splash screen
- [ ] Build Xcode + TestFlight

---

## 🚀 Commandes utiles

```bash
# Développement
npm run dev

# Build web
npm run build

# Preview build
npm run preview

# Mise à jour contenu (manuel)
npm run curate
npm run synthesize

# iOS
npx cap add ios
npx cap sync
npx cap open ios
```

---

## 📱 Communication SMS (Claude Phone)

Quand tu reçois une instruction par SMS (prompt commençant par `[SMS #...]`), tu peux communiquer avec l'utilisateur par SMS :

### Poser une question et attendre la réponse
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Ta question ici ?", "project": "avactu", "waitForReply": true, "timeout": 300}'
```
→ Envoie un SMS et **bloque jusqu'à la réponse** (timeout 5 min). La réponse est dans le champ `reply.body`.

### Notification simple (non bloquant)
```bash
curl -X POST http://localhost:3000/api/sms \
  -H "Content-Type: application/json" \
  -d '{"message": "Tâche terminée ✓", "project": "avactu"}'
```

### Acquitter un message traité
```bash
curl -X POST http://localhost:3000/api/inbox/<ID>/ack
```
→ Remplace `<ID>` par le numéro du message (ex: `#18` → `/api/inbox/18/ack`)

### Bonnes pratiques
- **Toujours demander confirmation** avant actions destructives (suppression, reset, etc.)
- **Envoyer une notification** quand une tâche longue est terminée
- **Acquitter le message** une fois la tâche complète

---

## 📝 Notes pour Claude Code

- Toujours utiliser TypeScript strict
- Préférer les composants fonctionnels avec hooks
- Utiliser Tailwind plutôt que CSS custom
- Les images doivent avoir un fallback (placeholder) en cas d'erreur de chargement
- Le Service Worker est critique : tester systématiquement le mode offline
- Pour les coordonnées GPS, utiliser des valeurs approximatives du centre de la zone concernée

---

## ⚠️ Informations critiques du projet

### Domaine et URLs
- **Domaine production** : `https://avactu.com` (PAS avactu.vercel.app)
- **APP_URL** dans les scripts : utiliser `avactu.com`

### Logo Avactu
Le logo est un **A stylisé cyan** avec :
- Globe mesh en arrière-plan (ellipses cyan)
- Lignes formant un A avec des nodes aux extrémités
- Petit coeur rouge au sommet
- Référence : `public/favicon.svg`

### Newsletter
- **Fréquences disponibles** : daily, biweekly (défaut), weekly
- **Scripts** : `send-newsletter:daily`, `send-newsletter:biweekly`, `send-newsletter:weekly`
- **Cron** : quotidien à 5h15 UTC, envoi conditionnel selon le jour
- **Inscription** : via `/api/subscribe` → email de confirmation → `/api/confirm?token=xxx`
- **Flow** : Toute inscription/modification requiert confirmation par email (token UUID, expire 24h)

---

## 🚫 Erreurs à éviter (leçons apprises)

### Général
1. **Ne pas deviner les URLs/domaines** — Toujours vérifier la config existante ou demander
2. **Lire les assets existants avant de les reproduire** — Ex: lire `favicon.svg` avant de créer une image avec le logo
3. **Tester les largeurs de texte en SVG** — Les badges doivent être assez larges pour le texte (prévoir ~10px par caractère en monospace 12px)
4. **Vérifier le répertoire de travail** — Si un fichier n'existe pas, chercher avec `find` avant de supposer le mauvais projet

### Vercel Serverless Functions
5. **Variables d'environnement séparées** — Les fonctions serverless n'ont PAS accès aux variables `VITE_*`. Il faut créer des variables sans préfixe :
   - `SUPABASE_URL` (pas VITE_SUPABASE_URL)
   - `SUPABASE_SERVICE_KEY` (la clé service_role, pas anon)
   - `RESEND_API_KEY`
   - `APP_URL`
6. **Toujours vérifier les env vars dans Vercel Dashboard** après avoir créé des API routes

### GitHub Actions Workflow
7. **Git add avec fichiers conditionnels** — Ne pas faire `git add file.json` si le fichier n'existe pas toujours. Utiliser : `[ -f file.json ] && git add file.json || true`

### Supabase & Sécurité
8. **RLS bloque les updates depuis le frontend** — La clé `anon` ne peut pas modifier les données si RLS est activé sans policy appropriée. Utiliser des API routes serverless avec `service_role` key
9. **Préférer la confirmation par email** — Pour les modifications sensibles (inscription, changement de préférences), utiliser un flow avec token de confirmation par email plutôt que des modifications directes

### Pipeline de contenu (curate → cluster → synthesize)
10. **Article IDs : utiliser un hash crypto, pas base64** — `Buffer.from(url).toString('base64').slice(0, 8)` donne `aHR0cHM6` pour TOUTE URL https → IDs tous identiques. Utiliser `createHash('sha256').update(url).digest('hex').slice(0, 8)`
11. **Déduplication inter-clusters : vérifier la similarité textuelle** — `areSameTopic()` dans `cluster.ts` ne doit PAS se limiter aux entités géopolitiques (`GEO_ENTITIES`). Les noms de personnes (Maxwell, Epstein, etc.) ne sont pas dans ce dictionnaire. Toujours inclure un check TF-IDF cosine similarity entre les textes des clusters (seuil ~0.25)
12. **Prompt caching sur l'API Claude** — Le system prompt est statique (~520 tokens) et envoyé 5-6 fois par pipeline. Toujours utiliser `cache_control: { type: 'ephemeral' }` sur le bloc system pour éviter de re-payer les input tokens. Format : `system: [{ type: 'text', text: PROMPT, cache_control: { type: 'ephemeral' } }]`
13. **Le seuil de similarité entités pour doublons doit rester ≤ 0.5** — À 0.6, deux clusters sur le même sujet avec des entités geo légèrement différentes (ex: {usa} vs {usa, uk}) passent le filtre
14. **Valider les images extraites : rejeter logos et placeholders** — Les CDN de presse (ex: Courrier International) servent parfois des images génériques (`logoarticle`, images datant de plusieurs années). Toujours valider via `isValidEditorialImage()` (dans `scripts/image-validation.ts`) qui rejette : URLs contenant `logo`, `placeholder`, `default`, `avatar` dans le nom de fichier ; images dont la date dans le chemin CDN est > 3 ans ; extensions `.svg`/`.ico`/`.gif`. Appliquer ce filtre dans `curate.ts` (extraction) ET `synthesize.ts` (sélection)
