# Avactu - Application d'actualité géopolitique pour Ava

## 🎯 Vision du projet

Application mobile permettant à Ava (16 ans) de comprendre l'actualité mondiale en **15 minutes tous les 2 jours**. L'objectif est de proposer un contenu de niveau adulte, synthétisé intelligemment, sans tomber dans la simplification "pour ados".

---

## 📊 Ratio de contenu (strict)

| Catégorie | Proportion | Focus |
|-----------|------------|-------|
| Géopolitique | 70% | Conflits, alliances, ressources, diplomatie |
| Économie | 20% | Macro-économie, tech, monnaie, marchés |
| Politique intérieure | 10% | Enjeux de société FR, pas de polémiques stériles |

**Volume par édition** : 5-6 stories maximum (pas plus).

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
│   └── synthesize.ts             # Synthèse via Claude API
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

export type Category = "geopolitique" | "economie" | "politique";

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
--accent-eco: sky-500;          /* #0ea5e9 */
--accent-politique: violet-500; /* #8b5cf6 */

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
  "category": "geopolitique" | "economie" | "politique",
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

## 📝 Notes pour Claude Code

- Toujours utiliser TypeScript strict
- Préférer les composants fonctionnels avec hooks
- Utiliser Tailwind plutôt que CSS custom
- Les images doivent avoir un fallback (placeholder) en cas d'erreur de chargement
- Le Service Worker est critique : tester systématiquement le mode offline
- Pour les coordonnées GPS, utiliser des valeurs approximatives du centre de la zone concernée
