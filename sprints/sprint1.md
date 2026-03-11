# 🐺 Sprint 1 — Foundation

**Sprint Goal:** A working skeleton — players can scan a QR code, log in, receive a role, and see a home screen. The GM can manage players and trigger role assignment.

**Duration:** March 3–9, 2026
**Estimated Total:** ~32 hours

---

## PBI-0: Dev Environment & Workflow Setup

> **Goal:** A fully configured local dev environment with CI/CD to Vercel, connected to Supabase, with a repeatable workflow.

### Tasks

- [ ] **T-0.1 — Install prerequisites**
  - Node.js 20 LTS, pnpm (faster than npm, better monorepo support)
  - Supabase CLI (`pnpm add -g supabase`)
  - Verify: `node -v && pnpm -v && supabase --version`

- [ ] **T-0.2 — Scaffold the project**
  ```bash
  pnpm create vite@latest lg-martigues -- --template react-ts
  cd lg-martigues
  pnpm install
  ```

- [ ] **T-0.3 — Install core dependencies**
  ```bash
  # Core
  pnpm add @supabase/supabase-js react-router-dom zustand
  # PWA
  pnpm add -D vite-plugin-pwa
  # Styling
  pnpm add -D tailwindcss @tailwindcss/vite
  # QR
  pnpm add html5-qrcode qrcode.react
  # Utilities
  pnpm add clsx date-fns
  # Linting
  pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier
  ```

- [ ] **T-0.4 — Configure Tailwind**
  - Update `vite.config.ts` to add the Tailwind plugin
  - Add `@import "tailwindcss";` directive to `src/index.css`

- [ ] **T-0.5 — Configure PWA**
  - Add `VitePWA()` plugin to `vite.config.ts` with:
    - `registerType: 'autoUpdate'`
    - App name: "Loups-Garous de Martigues"
    - Theme color: `#2B3A4E`
    - Icons: 192px and 512px (placeholder for now)
  - Verify: build and check that `manifest.webmanifest` is generated

- [ ] **T-0.6 — Project structure**
  ```
  src/
  ├── components/       # Shared UI components
  │   ├── ui/           # Buttons, modals, toasts, timer
  │   └── layout/       # Shell, nav, guards
  ├── features/         # Feature modules
  │   ├── auth/         # QR login, session
  │   ├── game/         # Role reveal, game state
  │   ├── voting/       # Vote screens, results
  │   ├── werewolf/     # Private werewolf channel
  │   ├── challenges/   # Beer pong, pub crawl, mad scientists
  │   ├── powerups/     # Shields, clairvoyance, QR rewards
  │   ├── gm/           # All GM admin panels
  │   └── tv/           # TV projection view
  ├── lib/              # Supabase client, helpers, constants
  ├── stores/           # Zustand stores (game, auth, notifications)
  ├── hooks/            # Shared custom hooks
  ├── types/            # TypeScript types & enums
  └── App.tsx           # Router setup
  ```

- [ ] **T-0.7 — Create Supabase project**
  - Go to [supabase.com](https://supabase.com), create project "lg-martigues"
  - Note the project URL and anon key
  - Create `.env.local`:
    ```env
    VITE_SUPABASE_URL=https://xxxxx.supabase.co
    VITE_SUPABASE_ANON_KEY=xxxxx
    ```
  - Create `src/lib/supabase.ts` client singleton

- [ ] **T-0.8 — Supabase CLI local dev setup**
  ```bash
  supabase init
  supabase link --project-ref <your-project-ref>
  supabase db pull   # sync remote schema locally
  ```
  - All migrations go in `supabase/migrations/` and are version-controlled

- [ ] **T-0.9 — Git + Vercel**
  - `git init`, create GitHub repo, push initial commit
  - Connect repo to Vercel (auto-deploy on push to `main`)
  - Set env vars in Vercel dashboard (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  - Verify: push → Vercel deploys → app loads at `https://lg-martigues.vercel.app`

- [ ] **T-0.10 — VSCode workspace config**
  - Create `.vscode/settings.json`:
    ```json
    {
      "editor.defaultFormatter": "esbenp.prettier-vscode",
      "editor.formatOnSave": true,
      "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
      "typescript.preferences.importModuleSpecifier": "relative"
    }
    ```
  - Recommended extensions: ESLint, Prettier, Tailwind CSS IntelliSense, Supabase (for SQL highlighting)
  - Copilot is already installed — enable it for `.ts`, `.tsx`, `.sql` files

**Estimated time: 4h**
**Definition of Done:** `pnpm dev` serves the app locally, Vercel deploys on push, Supabase is connected and returns a health check.

---

## PBI-1: Supabase Schema — Players & Game State

> **Goal:** The foundational database tables exist, with Row Level Security enforced, supporting player records and global game state.

### Tasks

- [ ] **T-1.1 — Create migration: `players` table**
  ```sql
  -- supabase/migrations/001_players.sql
  CREATE TYPE player_role AS ENUM ('villager', 'werewolf');
  CREATE TYPE player_status AS ENUM ('pending', 'alive', 'ghost');

  CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    auth_token TEXT UNIQUE NOT NULL,
    role player_role,
    status player_status DEFAULT 'pending',
    team_id TEXT,
    shields INT DEFAULT 0,
    clairvoyance_count INT DEFAULT 0,
    is_gm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-1.2 — Create migration: `game_state` table**
  ```sql
  CREATE TYPE game_phase AS ENUM (
    'setup', 'role_reveal', 'playing', 'final_vote', 'finished'
  );

  CREATE TABLE game_state (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton row
    phase game_phase DEFAULT 'setup',
    current_round INT DEFAULT 0,
    is_final_vote BOOLEAN DEFAULT FALSE,
    werewolf_count INT DEFAULT 3,
    villager_count INT DEFAULT 13,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  INSERT INTO game_state (id) VALUES (1);
  ```

- [ ] **T-1.3 — RLS policies for `players`**
  ```sql
  ALTER TABLE players ENABLE ROW LEVEL SECURITY;

  -- Players can read only their own record
  CREATE POLICY "players_read_own"
    ON players FOR SELECT
    USING (auth.uid()::text = id::text);

  -- GM can read all
  CREATE POLICY "gm_read_all_players"
    ON players FOR SELECT
    USING (
      EXISTS (SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true)
    );

  -- GM can update all
  CREATE POLICY "gm_update_players"
    ON players FOR UPDATE
    USING (
      EXISTS (SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true)
    );
  ```

- [ ] **T-1.4 — RLS policies for `game_state`**
  ```sql
  ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

  -- Everyone can read game state
  CREATE POLICY "anyone_read_game_state"
    ON game_state FOR SELECT USING (true);

  -- Only GM can update
  CREATE POLICY "gm_update_game_state"
    ON game_state FOR UPDATE
    USING (
      EXISTS (SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true)
    );
  ```

- [ ] **T-1.5 — Enable Realtime on both tables**
  - In Supabase dashboard → Database → Replication, enable `players` and `game_state`
  - Or via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE players, game_state;`

- [ ] **T-1.6 — Apply & verify migrations**
  ```bash
  supabase db push
  ```
  - Verify tables exist in Supabase Table Editor
  - Manually insert a test player, confirm RLS blocks unauthorized reads

- [ ] **T-1.7 — Generate TypeScript types**
  ```bash
  supabase gen types typescript --linked > src/types/supabase.ts
  ```

**Estimated time: 4h**
**Definition of Done:** Tables exist in production Supabase. RLS policies verified manually. Types generated and imported in the project.

---

## PBI-2: QR Code Login Flow

> **Goal:** Each player scans a unique QR code to authenticate. The GM can generate and re-issue codes.

### Tasks

- [ ] **T-2.1 — GM: pre-seed player records**
  - Create an Edge Function `seed-players` or a script that inserts 16 player rows with:
    - `name`: player's real first name
    - `auth_token`: a random unique string (e.g., `nanoid(12)`)
    - `status`: `pending`
    - `role`: null (assigned later)
  - Also create 1 GM row with `is_gm: true`

- [ ] **T-2.2 — GM: QR code generation page**
  - Route: `/gm/qr-codes`
  - For each player, generate a QR code encoding the URL:
    `https://lg-martigues.vercel.app/login?token=<auth_token>`
  - Use `qrcode.react` to render QR codes
  - Print-friendly layout: player name + QR code, one per card
  - Add a "Regenerate token" button per player (updates `auth_token` in DB)

- [ ] **T-2.3 — Player: QR scan screen**
  - Route: `/login`
  - If the URL already contains `?token=xxx`, auto-authenticate (for QR codes that encode the full URL)
  - Also provide a manual "Scan QR Code" button using `html5-qrcode`:
    - Opens camera
    - On successful scan, extracts the token from the URL
  - Call Supabase to look up the player by `auth_token`
  - On success: store session in Zustand + localStorage, redirect to `/lobby`
  - On failure: show error "Invalid QR code. Ask your GM for a new one."

- [ ] **T-2.4 — Auth store (Zustand)**
  - `src/stores/authStore.ts`
  - State: `player` (Player | null), `isGM` (boolean), `isLoading`
  - Actions: `login(token)`, `logout()`, `refreshPlayer()`
  - Persist player ID to localStorage for session recovery
  - On app load, attempt to restore session from stored player ID

- [ ] **T-2.5 — Route guards**
  - `<PlayerGuard>`: redirects to `/login` if not authenticated
  - `<GMGuard>`: redirects to `/` if not GM
  - `<GhostGuard>`: blocks voting routes if player is a ghost
  - Wrap all app routes accordingly in `App.tsx`

- [ ] **T-2.6 — Session recovery**
  - On app startup, check localStorage for a stored player ID
  - If found, fetch the player record from Supabase
  - If the record is valid, restore session silently
  - If not (token revoked, player not found), clear storage and show login

**Estimated time: 6h**
**Definition of Done:** A test player can scan a QR code on their phone, land in the app authenticated, close the browser, reopen, and still be logged in. The GM can generate/regenerate QR codes.

---

## PBI-3: Lobby & Pending Allocation Screen

> **Goal:** After login, players land on a waiting screen showing all connected players, until the GM starts the game.

### Tasks

- [ ] **T-3.1 — Lobby screen**
  - Route: `/lobby`
  - Display: "PENDING ALLOCATION" in large text, atmospheric styling (dark theme, wolf motif)
  - Show a live list of connected players (subscribe to `players` table via Supabase Realtime)
  - Player count indicator: "12 / 16 players connected"
  - Subtle pulse animation while waiting

- [ ] **T-3.2 — Realtime subscription for lobby**
  - Subscribe to `INSERT` and `UPDATE` events on the `players` table
  - When a new player logs in (status changes from null to `pending`), the list updates live
  - Use a custom hook: `useRealtimePlayers()`

- [ ] **T-3.3 — GM: lobby control**
  - On the GM dashboard, show the same player list with connection status
  - "Start Game" button (disabled until all 16 players are connected, with override option)
  - Clicking "Start Game" triggers role assignment (PBI-4)

- [ ] **T-3.4 — Navigation logic**
  - If `game_state.phase === 'setup'` → show Lobby
  - If `game_state.phase === 'role_reveal'` → redirect to Role Reveal
  - If `game_state.phase === 'playing'` → redirect to Home Dashboard
  - Subscribe to `game_state` changes to auto-redirect

**Estimated time: 3h**
**Definition of Done:** Multiple phones show the lobby simultaneously. When a new player scans their QR code, all other lobbies update in real time. GM sees the full list with a Start button.

---

## PBI-4: Role Assignment & Reveal

> **Goal:** The GM triggers role distribution. Each player sees a dramatic reveal of their role. Werewolves get a secret meeting point.

### Tasks

- [ ] **T-4.1 — Role assignment Edge Function**
  - Supabase Edge Function: `assign-roles`
  - Input: `{ werewolf_count: number }` (default: 3)
  - Logic:
    1. Fetch all players with `status = 'pending'` and `is_gm = false`
    2. Shuffle the list (Fisher-Yates)
    3. Assign first N as `werewolf`, rest as `villager`
    4. Update all player rows with their role and set `status = 'alive'`
    5. Update `game_state.phase` to `'role_reveal'`
  - Security: only callable by GM (check `is_gm` on the caller)

- [ ] **T-4.2 — Role reveal screen**
  - Route: `/reveal`
  - Dramatic animation sequence:
    1. Screen goes dark, suspenseful text ("Your fate is being decided...")
    2. After 3-4 seconds, the role card flips/fades in
    3. **Villager**: warm golden theme, "You are a Villager. Trust no one."
    4. **Werewolf**: red/dark theme, "You are a Werewolf." + meeting point instructions
  - The reveal plays once. After dismissal, the player is redirected to `/home`

- [ ] **T-4.3 — Werewolf meeting point**
  - Werewolves see an additional message after the reveal: a secret location in the house where they should discreetly meet to discover each other
  - The meeting point text is stored in `game_state.metadata` (JSONB), set by the GM before starting

- [ ] **T-4.4 — GM: role assignment controls**
  - On the GM dashboard, a "Start Game" flow:
    1. Set werewolf count (slider, default 3)
    2. Set meeting point text (free text input)
    3. Confirm → calls `assign-roles` Edge Function
  - After assignment, GM sees a full role list (who is what) for reference

- [ ] **T-4.5 — Skeleton Home Dashboard**
  - Route: `/home`
  - For Sprint 1, a minimal screen showing:
    - Player's name and role icon (discreet — no one looking over their shoulder should read it easily)
    - Current game phase
    - "Next event" placeholder
    - Notification bell (empty for now)
  - This screen will be expanded in Sprint 2

**Estimated time: 5h + 4h (GM dashboard)**
**Definition of Done:** GM triggers role assignment, all 16 phones immediately show the role reveal animation, werewolves see meeting point info, everyone lands on a basic home screen.

---

## PBI-5: Sprint 1 Testing

> **Goal:** Verify the entire Sprint 1 flow on real Android & iOS devices. Catch PWA quirks early.

### Tasks

- [ ] **T-5.1 — Device testing matrix**
  Test on at minimum:
  | Device         | Browser        | Test                         |
  |----------------|----------------|------------------------------|
  | Android (any)  | Chrome         | QR scan, login, PWA install  |
  | iPhone (any)   | Safari         | QR scan, login, Add to Home  |
  | iPad (if avail)| Safari         | GM dashboard usability       |
  | Laptop         | Chrome         | GM dashboard, /tv route      |

- [ ] **T-5.2 — QR login flow test**
  - Print 3–4 test QR codes
  - Scan from each device type
  - Verify: correct player loaded, session persists after closing browser
  - Verify: invalid QR shows error message

- [ ] **T-5.3 — Realtime lobby test**
  - Open lobby on 3+ devices simultaneously
  - Log in on a new device → verify all others update within 2 seconds
  - Kill and reopen the app → verify session restores

- [ ] **T-5.4 — Role reveal test**
  - Seed 4 test players, assign roles (1 werewolf, 3 villagers)
  - Verify each device shows the correct role with animation
  - Verify werewolf sees meeting point; villagers do not
  - Verify redirect to home dashboard after dismissal

- [ ] **T-5.5 — PWA installation test**
  - Android Chrome: verify "Add to Home Screen" banner appears
  - iOS Safari: manually "Add to Home Screen" → verify app icon, standalone mode, splash screen
  - Verify the app works after install (not just in-browser)

- [ ] **T-5.6 — Bug triage & fixes**
  - Log all issues found in the tests above
  - Fix P0 issues (blockers) before Sprint 1 close
  - Carry P1 issues (cosmetic, minor) to Sprint 2 backlog

**Estimated time: 3h**
**Definition of Done:** The full QR → Login → Lobby → Role Reveal → Home flow works end-to-end on Android Chrome and iOS Safari. PWA installs cleanly. No P0 bugs remain.

---

## Sprint 1 — Summary

| PBI | Title | Est. Hours | Priority |
|-----|-------|------------|----------|
| PBI-0 | Dev Environment & Workflow Setup | 4h | P0 |
| PBI-1 | Supabase Schema — Players & Game State | 4h | P0 |
| PBI-2 | QR Code Login Flow | 6h | P0 |
| PBI-3 | Lobby & Pending Allocation | 3h | P0 |
| PBI-4 | Role Assignment & Reveal | 9h | P0 |
| PBI-5 | Sprint 1 Testing | 3h | P0 |
| | **Total** | **~29h** | |

### Sprint 1 Exit Criteria

- [ ] The Vercel deployment is live and accessible
- [ ] 16 player QR codes can be generated and printed
- [ ] A player can scan → log in → see lobby → receive role → land on home
- [ ] The GM can manage players and trigger role assignment
- [ ] Realtime updates work across multiple devices simultaneously
- [ ] PWA installs correctly on both Android and iOS
- [ ] No P0 bugs remain open