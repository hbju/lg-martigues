# 🐺 Sprint 4 — Polish, Final Vote & Dress Rehearsal

**Sprint Goal:** Production-ready. The Final Vote mechanic works, offline resilience is solid, UX is polished, edge cases are handled, and a full dress rehearsal has been run with no showstoppers.

**Duration:** March 24–30, 2026
**Estimated Total:** ~36 hours

---

## PBI-22: Final Vote (Monday Morning)

> **Goal:** With 6 players remaining, the app enters a special iterative elimination mode. Players can keep eliminating or stop, then all remaining roles are revealed.

### Tasks

- [ ] **T-22.1 — Final Vote game phase**
  - When the GM eliminates the 8th player (8 → 6 remaining), a prompt appears on the GM panel:
    - "6 players remain. Enter Final Vote mode?"
    - On confirm: `game_state.phase = 'final_vote'`, `game_state.is_final_vote = true`
  - All players and the TV are notified: "The Final Vote begins."

- [ ] **T-22.2 — Iterative elimination flow**
  - The Final Vote is a loop:
    1. GM opens a vote round with `type: 'final'`
    2. All remaining alive players vote as in a normal council
    3. After resolution, the GM confirms the elimination
    4. Then a decision prompt appears for all remaining players:
       - **"Continue eliminating?"** — majority vote via the app (simple yes/no poll)
       - If majority says **yes** → GM opens another final vote round
       - If majority says **no** → the game ends, trigger the reveal
  - The continue/stop vote is a lightweight poll, not a full vote round:
    - `vote_rounds` row with `type: 'final'` and `metadata: { "subtype": "continue_poll" }`
    - Binary choice: "Continue" or "Stop"
    - Simple majority decides

- [ ] **T-22.3 — Continue/Stop poll UI**
  - After each Final Vote elimination, players see a modal:
    - "Do you believe there are still Werewolves among you?"
    - Two large buttons: "🔍 Keep Hunting" / "✋ We Are Safe"
    - Short timer (e.g., 2 minutes) — no vote = abstain (doesn't count toward majority)
  - Result shown to all: "The group decided to continue / stop." (vote counts hidden — only the decision)

- [ ] **T-22.4 — Final reveal Edge Function**
  - Supabase Edge Function: `final-reveal`
  - Triggered when the group votes to stop, or when the GM manually triggers it
  - Logic:
    1. Set `game_state.phase = 'finished'`
    2. Fetch all remaining alive players with their roles
    3. Determine winner:
       - If any alive player has `role = 'werewolf'` → Werewolves win
       - If all alive players are villagers → Villagers win
    4. Store result in `game_state.metadata`: `{ "winner": "villagers" | "werewolves", "survivors": [...] }`
    5. Broadcast notification to ALL players (alive + ghosts): "The game is over!"
    6. Unlock all roles: update RLS or set a flag so every player can now see everyone's role

- [ ] **T-22.5 — Player: final reveal screen**
  - Route: `/reveal/final`
  - All players (alive and ghosts) see:
    - The list of remaining players
    - Roles revealed one by one with dramatic pacing (2-second delay per player)
    - Villager = gold highlight, Werewolf = red highlight
    - After all reveals: "THE VILLAGERS WIN!" or "THE WEREWOLVES WIN!" in large text
    - Confetti or blood splatter animation matching the winner
  - Below the reveal: full game recap — every elimination in order, every role, who infected whom

- [ ] **T-22.6 — Game recap / post-mortem view**
  - Route: `/recap`
  - Available after the game ends (accessible from the final reveal screen)
  - Shows a timeline of every game event:
    - Each council vote: who voted for whom, who was eliminated
    - Each murder: who the werewolves targeted
    - Infection: who was turned and when
    - Power-up usage: who used clairvoyance on whom, when shields were consumed
    - Challenge winners
  - This is the "war stories" screen — meant to fuel post-game conversation
  - All data is now readable since the game is over (RLS relaxed for `phase = 'finished'`)

- [ ] **T-22.7 — GM: manual game end**
  - The GM can force-end the game at any time (emergency escape hatch):
    - "End Game Now" button with confirmation modal
    - Triggers `final-reveal` regardless of player count
  - Also: "Reset Game" button to wipe all state and start fresh (useful for testing, or if something goes catastrophically wrong)

**Estimated time: 8h**
**Definition of Done:** Final Vote mode activates at 6 players, iterative vote/stop loop works, final reveal plays dramatically on all screens and the TV, game recap is viewable, GM can force-end and reset.

---

## PBI-23: Offline Resilience & Reconnection

> **Goal:** The app handles spotty connectivity gracefully — especially during the Marseille pub crawl. No data is lost, and the experience degrades softly.

### Tasks

- [ ] **T-23.1 — Service worker caching strategy**
  - Configure `vite-plugin-pwa` Workbox strategy:
    - **App shell** (HTML, JS, CSS, images): `CacheFirst` — always available offline
    - **API calls** (Supabase): `NetworkFirst` with fallback to cached response
    - **Static assets** (fonts, icons): `CacheFirst` with long TTL
  - Precache the complete app shell at install time
  - Verify: put the phone in airplane mode → the app still opens and shows the last-known state

- [ ] **T-23.2 — Optimistic vote queueing**
  - When a player casts a vote but has no connectivity:
    1. Store the vote in an in-memory queue (Zustand) and localStorage
    2. Show the player: "Vote recorded. Syncing..." with a subtle offline indicator
    3. When connectivity returns, flush the queue → `INSERT INTO votes`
    4. If the round has already closed by the time the sync happens: discard the queued vote and notify the player: "Your vote couldn't be submitted in time."
  - This only applies to council votes during pub crawl — at the house, Wi-Fi is reliable

- [ ] **T-23.3 — Realtime reconnection handling**
  - Supabase Realtime WebSocket can drop on mobile networks
  - Implement reconnection logic in the subscription hooks:
    1. Detect WebSocket disconnect (Supabase client emits `CLOSED` / `CHANNEL_ERROR`)
    2. Show a non-intrusive banner: "Reconnecting..." at the top of the screen
    3. Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
    4. On reconnect: re-subscribe to all channels, fetch latest state via REST API to catch missed events
    5. Dismiss the banner: "Back online!"
  - Create a `useConnectionStatus()` hook that all components can consume

- [ ] **T-23.4 — Stale data detection**
  - After reconnection, compare the local game state version with the server:
    - `game_state.updated_at` timestamp
    - If stale: force-refresh all active subscriptions and refetch player data
  - Prevents a scenario where a player reconnects and sees an outdated game phase

- [ ] **T-23.5 — Offline indicator**
  - Global component: `<ConnectionBanner />`
  - Three states:
    - 🟢 Online (hidden — default)
    - 🟡 Reconnecting (yellow banner, pulsing)
    - 🔴 Offline (red banner, persistent, with "Last updated X minutes ago")
  - Uses `navigator.onLine` + WebSocket status for accurate detection

- [ ] **T-23.6 — Pub crawl specific: team connectivity fallback**
  - Per the design constraints: at least one team member will have connectivity at any time
  - In the pub crawl view, show a "Team Status" indicator:
    - Fetched from Realtime: which team members are currently connected
    - If the current player is offline, show: "Your teammate [Name] is connected and can submit for the team."
  - This is informational, not functional — just reassurance

**Estimated time: 5h**
**Definition of Done:** App loads offline from cache. Votes queue and sync when back online. WebSocket reconnects automatically with exponential backoff and state refresh. Connection banner displays accurate status.

---

## PBI-24: UX Polish & Animations

> **Goal:** The app feels like a real game, not a developer prototype. Smooth transitions, atmospheric visuals, and a cohesive dark theme.

### Tasks

- [ ] **T-24.1 — Design system & theme**
  - Finalize the color palette:
    - Background: deep navy `#0F1923`
    - Surface: dark slate `#1A2735`
    - Primary accent: blood red `#C41E3A`
    - Secondary accent: moon gold `#D4A843`
    - Text: off-white `#E8E0D4`
    - Ghost: desaturated blue-grey `#5A6672`
  - Typography: system font stack with a serif accent for dramatic text (role reveals, eliminations)
  - Apply consistently across all screens

- [ ] **T-24.2 — Page transitions**
  - Add smooth transitions between routes using `framer-motion` or CSS transitions:
    ```bash
    npm add framer-motion
    ```
  - Key transitions:
    - Lobby → Role Reveal: dramatic fade-to-black
    - Home → Vote Screen: slide-in from bottom
    - Vote Screen → Results: crossfade
    - Alive → Ghost: desaturation animation (color drains from the screen)
  - Keep transitions under 400ms — snappy, not sluggish

- [ ] **T-24.3 — Role reveal animation refinement**
  - Enhance the Sprint 1 role reveal:
    - Add a card-flip effect (3D CSS transform)
    - Villager card: golden border, torch/flame particle effect
    - Werewolf card: red border, fog/mist effect, subtle wolf howl audio cue
    - Delay: 3 seconds of suspense ("Your fate is sealed...") before the flip
  - Final reveal (Monday): same card style but revealed sequentially for each player

- [ ] **T-24.4 — Vote screen polish**
  - Animated progress ring around the countdown timer
  - Player avatars: use circular uploaded photos instead of initials
  - Vote confirmation: brief haptic feedback + visual pulse on the selected name
  - "Vote cast" state: card greys out with a checkmark overlay

- [ ] **T-24.5 — Loading states & skeletons**
  - Replace all loading spinners with skeleton screens matching the content layout
  - Key areas: player list, vote screen, challenge views, notification panel
  - Use a shimmer animation on skeleton elements

- [ ] **T-24.6 — Error states**
  - Friendly error messages for all failure modes:
    - Network error: "Something went wrong. Check your connection and try again." + retry button
    - Vote failed: "Your vote couldn't be submitted. Please try again."
    - QR scan failed: "Couldn't read the QR code. Try holding your phone steadier."
    - Session expired: "Your session has expired. Please scan your QR code again."
  - No raw error messages or stack traces ever shown to players

- [ ] **T-24.7 — Haptic & audio feedback**
  - Add subtle `navigator.vibrate()` calls for:
    - Receiving a notification (200ms pulse)
    - Casting a vote (100ms tap)
    - Being eliminated (3x 200ms pulses)
  - Optional sound effects (with mute toggle):
    - Vote countdown: ticking clock in the last 10 seconds
    - Elimination announcement: dramatic sting
    - Role reveal: suspense buildup + reveal chord
  - Audio files: use small MP3s, precached by the service worker

- [ ] **T-24.8 — Responsive layout audit**
  - Test all screens on:
    - Small phone (320px width — iPhone SE / older Android)
    - Standard phone (375–414px)
    - Large phone / small tablet (428px+)
    - TV / desktop (1920px — `/tv` route)
  - Fix any overflow, text truncation, or touch target issues (minimum 44px tap targets)
  - Verify the GM dashboard is usable on phone (it'll mainly be used on a laptop, but should work on mobile too)

**Estimated time: 5h**
**Definition of Done:** The app has a cohesive dark theme, smooth page transitions, polished role reveal animations, skeleton loading states, friendly error messages, and works cleanly on all screen sizes.

---

## PBI-25: GM QR Code Printable PDF

> **Goal:** The GM can generate a single printable PDF containing all player login QR codes and all reward QR codes, ready to cut out.

### Tasks

- [ ] **T-25.1 — Player login QR print sheet**
  - From `/gm/qr-codes`, a "Print Login QR Codes" button
  - Generates a print-optimized layout:
    - 4 QR cards per A4 page
    - Each card: player name (large), QR code, and small instruction text: "Scan with the Loups-Garous app"
    - Dotted cut lines between cards
  - Uses `@media print` CSS or generates a client-side PDF
  - Recommendation: use `html2canvas` + `jsPDF` for a downloadable PDF, avoiding print dialog inconsistencies
    ```bash
    pnpm add html2canvas jspdf
    ```

- [ ] **T-25.2 — Reward QR print sheet**
  - From the same page, a "Print Reward QR Codes" button
  - Each card: QR code only (no label — the label is for GM tracking, not for players to see)
  - Smaller cards: 6–8 per A4 page (they'll be hidden around the house, so compact is better)
  - GM also gets a separate "cheat sheet" page: a list of all reward QR codes with their label and reward type, for reference during the game

- [ ] **T-25.3 — Pre-event checklist on GM panel**
  - A `/gm/checklist` route with everything the GM needs to do before Friday:
    - [ ] All 16 player accounts created
    - [ ] Login QR codes printed and cut
    - [ ] Reward QR codes printed and hidden
    - [ ] Beer Pong challenge created
    - [ ] Pub Crawl teams and routes configured
    - [ ] Mad Scientists challenge created
    - [ ] Meeting point text set for werewolves
    - [ ] TV browser opened and tested on the living room screen
  - Each item links to the relevant GM panel section

**Estimated time: 3h**
**Definition of Done:** GM can download a clean PDF of login QR cards and reward QR cards. A pre-event checklist ensures nothing is forgotten.

---

## PBI-26: Edge Cases & Security Hardening

> **Goal:** Handle all the weird things that will inevitably happen with 17 people on their phones for three days.

### Tasks

- [ ] **T-26.1 — Double vote prevention**
  - Already handled by `UNIQUE(round_id, voter_id)` constraint
  - Add client-side guard: after casting, disable the vote button and hide the target list
  - If the Supabase insert fails with a unique constraint violation, show: "You've already voted this round."

- [ ] **T-26.2 — Concurrent vote round prevention**
  - The GM should not be able to open two vote rounds simultaneously
  - Before creating a new `vote_rounds` row, check: `SELECT count(*) FROM vote_rounds WHERE status = 'open'`
  - If > 0: show error "A vote round is already in progress. Close it first."
  - Enforce this in the Edge Function, not just the UI (defense in depth)

- [ ] **T-26.3 — Race condition on timer expiry**
  - Scenario: a player submits a vote at the exact moment the GM closes the round
  - Resolution: the Edge Function is the single source of truth
    - When resolving, first set `vote_rounds.status = 'closed'` (blocking new inserts via RLS)
    - Then tally existing votes
    - A vote INSERT that arrives after status change is rejected by RLS — the client shows a graceful error

- [ ] **T-26.4 — Session hijacking prevention**
  - Auth tokens in QR codes are one-time use: after first login, the token is invalidated and replaced with a Supabase session
  - If someone tries to reuse a scanned QR: "This code has already been used."
  - The GM can re-issue a fresh token if a player genuinely loses their session

- [ ] **T-26.5 — Dev tools snooping mitigation**
  - A savvy player might open browser dev tools to inspect network requests
  - Mitigations (already in place via RLS, but verify):
    - [ ] A villager fetching `/rest/v1/players` sees ONLY their own row
    - [ ] A villager fetching `/rest/v1/vote_rounds?type=eq.murder` gets an empty result
    - [ ] A player fetching `/rest/v1/votes` for an open round gets an empty result (votes visible only after resolution)
    - [ ] The werewolf discovery flag prevents seeing teammate names before the in-person meeting
  - Add a test script that runs all these checks against the API with different auth tokens

- [ ] **T-26.6 — GM admin route protection**
  - All `/gm/*` routes require `is_gm = true` (already guarded in Sprint 1)
  - Verify: a regular player navigating to `/gm/dashboard` directly is redirected to `/home`
  - All GM Edge Functions check the caller's `is_gm` flag server-side

- [ ] **T-26.7 — Data integrity checks**
  - Add Postgres constraints:
    - A ghost cannot be the target of a murder (CHECK or trigger)
    - A ghost cannot cast a vote (enforced by RLS + trigger)
    - `werewolf_count` in `game_state` must stay in sync with actual werewolf count (trigger on `players` update)
  - Create a `/gm/health` diagnostic page showing:
    - Player count by status (alive/ghost)
    - Role count (villagers/werewolves) vs. `game_state` counts
    - Any orphaned votes or unresolved rounds
    - Mismatch = red warning

- [ ] **T-26.8 — Error logging**
  - Add a simple error boundary (`src/components/ErrorBoundary.tsx`):
    - Catches React rendering errors
    - Shows: "Something went wrong. Tap to reload." (not a white screen)
    - Logs the error to the console (and optionally to a Supabase `error_logs` table for GM visibility)
  - Wrap the entire app in the error boundary

- [ ] **T-26.9 -- RLS auth.uid() Policies**
  - Migrate to Supabase Auth
  - Update RLS policies to use `auth.uid()` for row-level security

**Estimated time: 4h**
**Definition of Done:** All identified edge cases are handled. RLS policies verified with a test script. No way for a player to see another's role or votes via dev tools. GM routes are locked. Error boundary prevents white screens.

---

## PBI-27: Full Dress Rehearsal

> **Goal:** Simulate the entire Friday-to-Monday game flow with your girlfriend, playing both GM and multiple player roles, to catch any remaining issues.

### Tasks

- [ ] **T-27.1 — Rehearsal preparation**
  - Seed 8 test players (enough to exercise all mechanics):
    - 1 GM (you, on laptop)
    - 5 villagers, 2 werewolves
    - Assign names that are easy to track: "Alice", "Bob", "Charlie", etc.
  - Print login QR codes for all 8
  - Print 3 reward QR codes and hide them in the room
  - Open the TV view on a screen
  - Prepare 3–4 physical devices (your phones, tablets, laptop browsers with different sessions)

- [ ] **T-27.2 — Friday evening simulation**
  - [ ] Welcome: all "players" scan QR codes and log in
  - [ ] Lobby: verify all appear in real time
  - [ ] Role assignment: GM triggers → all devices show role reveal
  - [ ] Verify: werewolves see meeting point, villagers don't
  - [ ] Beer Pong: register 4 duos, generate bracket, play through, award immunity
  - [ ] TV: verify idle screen, then transitions during the above

- [ ] **T-27.3 — Saturday simulation**
  - [ ] Council vote #1 (noon): open, cast votes from multiple devices, let one timer expire (random assignment), resolve, confirm elimination → player becomes ghost
  - [ ] Murder #1: open murder window, werewolves vote (test unanimity success), GM confirms → victim becomes ghost
  - [ ] Pub Crawl: set up 2 teams with mock routes, log results, test destination reveal, test arrival + shield reward, test penalty flag
  - [ ] Council vote #2 (evening): repeat with fewer players
  - [ ] Murder #2 (night): test disagreement → random elimination

- [ ] **T-27.4 — Sunday simulation**
  - [ ] Council vote #3 + murder #3
  - [ ] Trigger lone werewolf condition → infection flow → verify new werewolf has channel access
  - [ ] Mad Scientists: run 2 rounds, assign roles, log winners, check leaderboard
  - [ ] QR code scan: find and scan reward QR codes, GM approves, verify inventory
  - [ ] Use clairvoyance on another player → verify private result
  - [ ] Shield test: target shielded player for murder → GM applies shield → murder blocked

- [ ] **T-27.5 — Monday simulation**
  - [ ] Eliminate down to 6 players
  - [ ] Final Vote mode activates
  - [ ] Run one elimination + continue/stop poll
  - [ ] Group votes to stop → final reveal plays on all screens + TV
  - [ ] Verify game recap screen shows full history
  - [ ] Test GM "Reset Game" to wipe state

- [ ] **T-27.6 — Offline / reconnection test**
  - During the Saturday simulation, toggle airplane mode on a device mid-vote:
    - [ ] Vote queues locally
    - [ ] Reconnection banner appears
    - [ ] Vote syncs on reconnect (if round still open)
    - [ ] If round closed, player sees "vote couldn't be submitted" message
  - Toggle airplane mode on the TV:
    - [ ] TV reconnects and catches up to current state

- [ ] **T-27.7 — Stress scenarios**
  - [ ] Two players vote at the exact same second → both recorded correctly
  - [ ] GM opens the app on two tabs simultaneously → no duplicate rounds
  - [ ] Player clears browser data mid-game → re-scan QR works
  - [ ] Player navigates to `/gm/dashboard` directly → redirected to `/home`
  - [ ] Player inspects network tab → confirm no role leaks

- [ ] **T-27.8 — Bug triage & final fixes**
  - Log everything, however minor
  - Fix ALL P0 and P1 issues — this is the last sprint
  - Accept P2 (cosmetic-only) issues that don't affect gameplay

**Estimated time: 8h** (including fix time)
**Definition of Done:** The entire game flow runs from Friday reveal to Monday final vote without any game-breaking or game-disrupting issues. Both you and your girlfriend are confident the app is ready.

---

## PBI-28: Deployment Checklist & Backup Plan

> **Goal:** Everything is production-ready, printed, deployed, and backed up. If the app fails catastrophically, there's a manual fallback.

### Tasks

- [ ] **T-28.1 — Production deployment**
  - Merge all code to `main` → Vercel auto-deploys
  - Verify the production URL loads correctly on Android + iOS
  - Verify Supabase production instance is clean (no leftover test data)
  - Set Supabase to production mode (disable direct SQL access for non-admins)

- [ ] **T-28.2 — Seed production data**
  - Create all 16 real player accounts with their actual first names
  - Create the GM account
  - Create all challenges (Beer Pong, Pub Crawl, Mad Scientists)
  - Create pub crawl teams and routes
  - Generate and store reward QR codes

- [ ] **T-28.3 — Print everything**
  - [ ] 16 login QR code cards (one per player)
  - [ ] 1 GM login card (for your phone)
  - [ ] Reward QR codes (as many as you want to hide)
  - [ ] GM cheat sheet: reward QR labels + locations
  - [ ] Pre-event checklist printed for physical reference

- [ ] **T-28.4 — Physical setup notes**
  - Document for yourself:
    - Where each reward QR code is hidden
    - Werewolf meeting point location
    - TV setup: which browser, which URL, fullscreen instructions
    - Wi-Fi network name + password (for guests)
  - Share the Wi-Fi info as part of the Friday briefing

- [ ] **T-28.5 — Backup plan: paper fallback**
  - Prepare the following, sealed in an envelope labeled "BREAK GLASS":
    - 16 printed role cards (13 Villager, 3 Werewolf) for manual distribution
    - A voting tally sheet (grid: voter × target)
    - Pen and paper for the GM to track eliminations, shields, clairvoyance
    - WhatsApp group for notifications (already exists for the friend group)
  - If the app goes down:
    1. Distribute role cards manually
    2. Run votes by show of hands or paper ballot
    3. GM tracks everything on paper
    4. WhatsApp for announcements
  - This isn't ideal, but it means the game goes on no matter what

- [ ] **T-28.6 — GM quick-reference card**
  - A single laminated (or sturdy) A4 sheet for yourself with:
    - The game timeline: when to open each vote, murder window, challenge
    - Quick list of GM panel routes and what they do
    - Emergency procedures: how to reset a vote, re-issue a QR, force-end the game
    - The Wi-Fi password and Vercel URL
  - Keep this on you at all times during the event

- [ ] **T-28.7 — Final pre-flight check (April 2, evening)**
  - [ ] Open the production app on your phone — login works
  - [ ] Open the production app on your girlfriend's phone — login works
  - [ ] Open `/tv` on the TV — loads and shows idle screen
  - [ ] Create a test vote round → cast a vote → resolve → delete test data
  - [ ] Scan one reward QR code → approve → delete test data
  - [ ] Check Supabase dashboard: all tables healthy, Realtime active, no errors in logs
  - [ ] Charge all devices overnight
  - [ ] Verify backup envelope is sealed and accessible

**Estimated time: 3h**
**Definition of Done:** Production is deployed, data is seeded, everything is printed, the backup plan exists, and a final pre-flight on April 2nd confirms everything works.

---

## Sprint 4 — Summary

| PBI | Title | Est. Hours | Priority |
|-----|-------|------------|----------|
| PBI-22 | Final Vote (Monday Morning) | 8h | P0 |
| PBI-23 | Offline Resilience & Reconnection | 5h | P0 |
| PBI-24 | UX Polish & Animations | 5h | P1 |
| PBI-25 | GM QR Code Printable PDF | 3h | P1 |
| PBI-26 | Edge Cases & Security Hardening | 4h | P0 |
| PBI-27 | Full Dress Rehearsal | 8h | P0 |
| PBI-28 | Deployment Checklist & Backup Plan | 3h | P0 |
| | **Total** | **~36h** | |

### Sprint 4 Exit Criteria

- [ ] Final Vote mode works: iterative elimination, continue/stop poll, final reveal
- [ ] Game recap shows the full post-mortem timeline
- [ ] App handles offline/reconnection gracefully with visual feedback
- [ ] All screens have polished transitions, loading states, and error handling
- [ ] QR code PDFs are generated and print cleanly
- [ ] All identified edge cases are handled and verified
- [ ] RLS security verified via test script — no data leaks
- [ ] Full dress rehearsal completed with no P0 or P1 bugs remaining
- [ ] Production deployed, data seeded, QR codes printed, backup plan prepared
- [ ] Pre-flight check on April 2nd passes