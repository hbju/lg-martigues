# 🐺 Les Loups-Garous de Martigues

Application web temps réel pour jouer aux Loups-Garous en soirée — inspirée des Loups-Garous de Thiercelieux.

Chaque joueur utilise son téléphone comme carte de jeu. Le Maître du Jeu (MJ) orchestre la partie depuis un dashboard dédié.

## Fonctionnalités

- **QR Code Login** — Chaque joueur scanne un QR code unique pour rejoindre la partie
- **Lobby temps réel** — Les joueurs voient en direct qui est connecté (Supabase Realtime)
- **Attribution des rôles** — Le MJ assigne aléatoirement Loups-Garous et Villageois
- **Révélation dramatique** — Animation immersive de révélation du rôle avec point de rendez-vous secret pour les loups
- **Dashboard joueur** — Rôle, boucliers, clairvoyances, état de la partie
- **Dashboard MJ** — Gestion des joueurs, contrôle du jeu, génération/impression de QR codes
- **PWA** — Installable sur Android et iOS, fonctionne en mode standalone

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Routing | React Router 7 |
| Backend | Supabase (PostgreSQL, Realtime, RLS) |
| QR | html5-qrcode (scan), qrcode.react (génération) |
| PWA | vite-plugin-pwa |

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Lancer en local
npm run dev
```

Créer un fichier `.env.local` à la racine :

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
```

## Base de données

Les migrations SQL se trouvent dans `supabase/migrations/` :

1. `001_players.sql` — Table `players` avec RLS
2. `002_game_state.sql` — Table `game_state` (singleton) avec RLS
3. `003_enable_realtime.sql` — Active le Realtime sur les deux tables

Données de test : `supabase/seed.sql` (16 joueurs + 1 MJ)

## Structure du projet

```
src/
├── components/layout/     # Guards (PlayerGuard, GMGuard, GhostGuard)
├── features/
│   ├── auth/              # LoginPage (QR scan)
│   ├── game/              # LobbyPage, RoleRevealPage, HomePage
│   └── gm/               # GMDashboardPage, GMQRCodesPage
├── hooks/                 # useRealtimePlayers
├── lib/                   # Client Supabase
├── stores/                # authStore, gameStore (Zustand)
└── types/                 # Types TypeScript + Database
```

## Routes

| Route | Accès | Description |
|-------|-------|-------------|
| `/login` | Public | Scan QR / authentification par token |
| `/lobby` | Joueur | Salle d'attente temps réel |
| `/reveal` | Joueur | Révélation du rôle |
| `/home` | Joueur | Dashboard personnel |
| `/gm` | MJ | Dashboard Maître du Jeu |
| `/gm/qr-codes` | MJ | Génération et impression des QR codes |

## Direction artistique

Thème inspiré des Loups-Garous de Thiercelieux :

- **Palette** — Ciel nocturne indigo, parchemin crème, lueur de bougie ambrée, rouge sang, clair de lune argenté
- **Typographies** — Cinzel (titres médiévaux), Crimson Text (corps), MedievalSharp (accents)
- **Ambiance** — Étoiles scintillantes, lune pâle, animation de flamme de bougie, cartes style parchemin
