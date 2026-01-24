# Avactu

Application mobile d'actualité géopolitique pour comprendre le monde en 15 minutes.

## Stack technique

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4
- **PWA**: vite-plugin-pwa + Workbox
- **Maps**: react-simple-maps
- **API**: Claude API (Anthropic)
- **SMS**: Twilio

## Développement

```bash
# Installation
npm install

# Développement
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## Pipeline de contenu

```bash
# 1. Curation (récupère les articles RSS)
npm run curate

# 2. Synthèse (génère les stories via Claude)
export ANTHROPIC_API_KEY=sk-ant-...
npm run synthesize

# 3. Test SMS (dry-run)
npm run send-sms -- --dry-run

# 4. Envoi SMS réel
export TWILIO_ACCOUNT_SID=...
export TWILIO_AUTH_TOKEN=...
export TWILIO_PHONE_NUMBER=+1...
export AVA_PHONE_NUMBER=+33...
npm run send-sms
```

## Déploiement Vercel

### Option 1 : Via GitHub (recommandé)

1. Push le code sur GitHub
2. Va sur [vercel.com](https://vercel.com) et importe le repo
3. Vercel détecte automatiquement Vite
4. Clique **Deploy**

### Option 2 : Via CLI

```bash
# Installation
npm install -g vercel

# Premier déploiement (preview)
vercel

# Déploiement production
vercel --prod
```

### Configuration avancée

- Variables d'environnement : aucune requise pour le frontend
- Pour activer le déploiement automatique via GitHub Actions :
  1. Créer un Deploy Hook (Settings > Git > Deploy Hooks)
  2. Ajouter l'URL dans les variables GitHub : `VERCEL_DEPLOY_HOOK`

## Configuration GitHub Actions

### Secrets requis

Aller dans Settings > Secrets and variables > Actions :

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Claude |
| `TWILIO_ACCOUNT_SID` | Account SID Twilio |
| `TWILIO_AUTH_TOKEN` | Auth Token Twilio |
| `TWILIO_PHONE_NUMBER` | Numéro expéditeur (+1...) |
| `AVA_PHONE_NUMBER` | Numéro destinataire (+33...) |

### Variables (optionnelles)

| Variable | Description | Default |
|----------|-------------|---------|
| `VERCEL_DEPLOY_HOOK` | URL du webhook Vercel | - |
| `APP_URL` | URL de l'app | avactu.vercel.app |

### Déclenchement manuel

1. Aller dans Actions > "Update Content & Send SMS"
2. Cliquer "Run workflow"
3. Optionnel : cocher "Skip SMS sending" pour tester sans envoyer

## Architecture

```
avactu/
├── public/
│   └── data/
│       └── stories.json       # Stories générées
├── src/
│   ├── components/           # Composants React
│   ├── hooks/                # Custom hooks
│   ├── types/                # TypeScript types
│   └── App.tsx               # Point d'entrée
├── scripts/
│   ├── curate.ts             # Curation RSS
│   ├── synthesize.ts         # Synthèse Claude
│   └── send-sms.ts           # Notification SMS
├── data/
│   └── raw-articles.json     # Articles bruts
├── config/
│   └── sources.json          # Sources RSS
└── .github/
    └── workflows/
        └── update-content.yml # Cron 48h
```

## Licence

Projet privé.
