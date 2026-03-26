# 🐺 Sprint 3 — Challenges, Power-ups & TV View

**Sprint Goal:** All challenge types are playable through the app, power-ups (shields & clairvoyance) work end-to-end, hidden QR codes grant rewards with GM approval, and the TV projection view is operational for dramatic results reveals.

**Duration:** March 17–23, 2026
**Estimated Total:** ~40 hours

---

## PBI-13: Supabase Schema — Power-ups, QR Codes & Challenges

> **Goal:** The database tables for power-ups, QR codes, and challenge management exist, with RLS enforced and Realtime enabled.

### Tasks

- [ ] **T-13.1 — Create migration: `power_ups` table**
  ```sql
  -- supabase/migrations/003_powerups_challenges.sql
  CREATE TYPE power_up_type AS ENUM ('shield', 'clairvoyance');
  CREATE TYPE power_up_source AS ENUM ('qr', 'challenge', 'meme', 'manual');

  CREATE TABLE power_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) NOT NULL,
    type power_up_type NOT NULL,
    source power_up_source NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    used_on UUID REFERENCES players(id),  -- target for clairvoyance, or round for shield
    granted_by_gm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-13.2 — Create migration: `qr_codes` table**
  ```sql
  CREATE TYPE qr_reward_type AS ENUM ('shield', 'clairvoyance');

  CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    label TEXT,                          -- e.g., "Kitchen drawer", for GM tracking
    reward_type qr_reward_type NOT NULL,
    scanned_by UUID REFERENCES players(id),
    scanned_at TIMESTAMPTZ,
    confirmed_by_gm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-13.3 — Create migration: `challenges` table**
  ```sql
  CREATE TYPE challenge_type AS ENUM ('beer_pong', 'pub_crawl', 'mad_scientists');
  CREATE TYPE challenge_status AS ENUM ('upcoming', 'active', 'completed');

  CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type challenge_type NOT NULL,
    status challenge_status DEFAULT 'upcoming',
    metadata JSONB DEFAULT '{}',       -- flexible storage for brackets, routes, rounds
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-13.4 — Create migration: `challenge_scores` table**
  ```sql
  CREATE TABLE challenge_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID REFERENCES challenges(id) NOT NULL,
    player_id UUID REFERENCES players(id),
    team_id TEXT,
    round_number INT,
    score INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',       -- round-specific data
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-13.5 — Create migration: `teams` table**
  ```sql
  CREATE TABLE teams (
    id TEXT PRIMARY KEY,               -- e.g., "team-alpha", "team-bravo"
    name TEXT NOT NULL,
    challenge_id UUID REFERENCES challenges(id),
    metadata JSONB DEFAULT '{}',       -- e.g., pub crawl route, bar list
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE team_members (
    team_id TEXT REFERENCES teams(id),
    player_id UUID REFERENCES players(id),
    PRIMARY KEY (team_id, player_id)
  );
  ```

- [ ] **T-13.6 — RLS policies**
  ```sql
  -- power_ups: players read own, GM reads/writes all
  ALTER TABLE power_ups ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "players_read_own_powerups" ON power_ups
    FOR SELECT USING (player_id::text = auth.uid()::text);
  CREATE POLICY "gm_manage_powerups" ON power_ups
    FOR ALL USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));

  -- qr_codes: players can update (scan), GM manages all
  ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "players_scan_qr" ON qr_codes
    FOR UPDATE USING (scanned_by IS NULL)  -- only unscanned codes
    WITH CHECK (scanned_by::text = auth.uid()::text);
  CREATE POLICY "gm_manage_qr" ON qr_codes
    FOR ALL USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));

  -- challenges & scores: everyone reads, GM writes
  ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anyone_read_challenges" ON challenges FOR SELECT USING (true);
  CREATE POLICY "gm_manage_challenges" ON challenges
    FOR ALL USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));

  ALTER TABLE challenge_scores ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anyone_read_scores" ON challenge_scores FOR SELECT USING (true);
  CREATE POLICY "gm_manage_scores" ON challenge_scores
    FOR ALL USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));

  ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anyone_read_teams" ON teams FOR SELECT USING (true);
  ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "anyone_read_team_members" ON team_members FOR SELECT USING (true);
  ```

- [ ] **T-13.7 — Enable Realtime & regenerate types**
  ```sql
  ALTER PUBLICATION supabase_realtime
    ADD TABLE power_ups, qr_codes, challenges, challenge_scores, teams, team_members;
  ```
  ```bash
  supabase gen types typescript --linked > src/types/supabase.ts
  ```

**Estimated time: 4h**
**Definition of Done:** All tables created, RLS verified, Realtime enabled, types regenerated.

---

## PBI-14: Shield Mechanic

> **Goal:** Shields protect a player from one elimination (murder or council vote). They are consumed on use and the GM is always in the loop.

### Tasks

- [ ] **T-14.1 — Power-up inventory screen**
  - Route: `/inventory` (accessible from home dashboard)
  - Shows all power-ups owned by the player: shields and clairvoyance charges
  - Each item shows: type icon, source ("Won in Beer Pong", "Found via QR"), used/unused status
  - This screen is shared between Shield and Clairvoyance — build it once

- [ ] **T-14.2 — Shield: automatic protection prompt**
  - When a player with a shield is the target of a council vote elimination:
    1. The GM sees: "[Name] has a shield. Apply it?" with "Yes (use shield)" / "No (override)" buttons
    2. If applied: the elimination is cancelled, the shield is consumed (`power_ups.used = true`), notification sent: "Your shield protected you!"
    3. If overridden: normal elimination proceeds (edge case — GM has final say)
  - Same logic for murder targets

- [ ] **T-14.3 — Shield: voluntary use before vote**
  - Before a council vote opens, a player with a shield sees a "Activate Shield" button on the vote screen
  - Activating it flags the player as shielded for this round (write to `vote_rounds.metadata` or a separate flag)
  - If they receive the most votes, the shield auto-blocks the elimination
  - Design decision: **go with the GM-mediated approach (T-14.2) for Sprint 3** — it's simpler and avoids premature shield burning. Voluntary activation can be a Sprint 4 polish item.

- [ ] **T-14.4 — Update elimination Edge Functions**
  - In both `resolve-council-vote` and `resolve-murder`:
    - After identifying the elimination target, check if they have an unused shield
    - If yes: flag the result as "shielded" in the response, do NOT auto-consume
    - The GM makes the final call via the confirmation step (T-14.2)

**Estimated time: 3h**
**Definition of Done:** A player with a shield who is voted out or murdered triggers a GM prompt. GM can apply the shield (cancels elimination, consumes shield) or override. Shield status visible in inventory.

---

## PBI-15: Clairvoyance Mechanic

> **Goal:** A player with clairvoyance can reveal one other player's role (Villager or Werewolf). One-time use, GM-confirmed.

### Tasks

- [ ] **T-15.1 — Clairvoyance: use flow**
  - In the power-up inventory (`/inventory`), next to each unused clairvoyance charge: a "Use" button
  - Flow:
    1. Player taps "Use" → modal shows list of alive players (excluding self)
    2. Player selects a target → confirmation: "Reveal [Name]'s role?"
    3. On confirm → write to `power_ups`: `used = true`, `used_on = target_id`
    4. Request goes to GM for confirmation (not instant reveal)

- [ ] **T-15.2 — GM: confirm clairvoyance**
  - GM panel shows: "[Player] wants to use clairvoyance on [Target]"
  - "Confirm" → trigger the reveal:
    - Fetch the target's role
    - Send a notification to the requesting player: "[Target] is a Villager / Werewolf"
    - The result is also stored in `power_ups.metadata` for reference
  - "Reject" → reset `power_ups.used = false`, notify player: "Your clairvoyance was blocked." (unlikely but edge case)

- [ ] **T-15.3 — Clairvoyance result display**
  - The notification shows the result clearly with visual emphasis (green for Villager, red for Werewolf); However, this notification is not stored in the player's notification history to maintain secrecy — it's a transient message.
  - This information is private — only the player who used it can see it (RLS enforced)

- [ ] **T-15.4 — Clairvoyance availability rules**
  - Clairvoyance can only be used while the player is alive
  - Clairvoyance can only target alive players
  - Ghosts cannot use clairvoyance (enforced by Ghost Guard + UI hiding)
  - The GM can restrict clairvoyance at low player counts via a toggle (noted in design doc: "only with enough people still alive")

**Estimated time: 3h**
**Definition of Done:** A player uses clairvoyance from their inventory, selects a target, GM confirms, and the player privately learns the target's role. Result persists in inventory.

---

## PBI-16: QR Code Scanning & Rewards

> **Goal:** Physical QR codes hidden around the house can be scanned in-app to claim rewards, pending GM approval.

### Tasks

- [ ] **T-16.1 — GM: QR code generation**
  - Route: `/gm/qr-codes` (extend the existing QR page from Sprint 1)
  - New section: "Reward QR Codes"
  - GM can create QR codes with:
    - Label (for tracking: "Behind the TV", "Kitchen drawer")
    - Reward type: Shield or Clairvoyance
  - Each QR encodes a URL: `https://lg-martigues.vercel.app/scan?code=<unique_code>`
  - Generate printable cards: label (GM-only, not visible to players) + QR code
  - Batch print layout: 4–6 QR codes per A4 page, print-friendly CSS

- [ ] **T-16.2 — Player: scan reward QR code**
  - Route: `/scan` (or reuse the existing QR scanner with mode detection)
  - When a player scans a reward QR:
    1. Extract the `code` parameter from the URL
    2. Look up the `qr_codes` row by `code`
    3. If already scanned: show "This QR code has already been claimed by [Player Name]."
    4. If unclaimed: update `scanned_by = current_player_id`, `scanned_at = now()`
    5. Show: "Reward claimed! Waiting for GM approval..." with a pending indicator
  - The scan button is accessible from the home dashboard (a small QR icon)

- [ ] **T-16.3 — GM: approve/reject QR scans**
  - On the GM panel, a "Pending QR Claims" section
  - Shows: player name, QR label, reward type, scanned timestamp
  - "Approve" → creates a `power_ups` row for the player, sends notification: "You found a [Shield/Clairvoyance]!"
  - "Reject" → resets `scanned_by` and `scanned_at` to null (code becomes available again), sends notification: "Your QR claim was rejected."
  - The GM might reject if someone scanned someone else's QR, or if conditions aren't met

- [ ] **T-16.4 — Prevent double-scans and abuse**
  - A QR code can only be scanned once (enforced by DB: `scanned_by IS NULL` check in RLS)
  - A player scanning a code that's already claimed gets a clear error
  - The player's camera permission is requested only when they tap the scan button, not on page load
  - If a player scans a login QR by mistake (from Sprint 1), the app detects the URL pattern and redirects gracefully

**Estimated time: 5h**
**Definition of Done:** GM generates and prints QR codes. A player scans one, sees "pending." GM approves, player receives the power-up in their inventory with a notification. Double scans are blocked.

---

## PBI-17: Beer Pong Tournament (Friday Challenge)

> **Goal:** Players register duos, the app generates a bracket, and the GM inputs results. The winning duo earns first-council immunity.

### Tasks

- [ ] **T-17.1 — Challenge data setup**
  - Create a `challenges` row for Beer Pong on game init (or via GM panel):
    ```json
    { "name": "Beer Pong Tournament", "type": "beer_pong", "status": "upcoming" }
    ```
  - `metadata` will store the bracket structure

- [ ] **T-17.2 — Player: duo registration**
  - Route: `/challenges/beer-pong`
  - When the challenge is `upcoming`:
    - Player sees a "Find a Partner" screen
    - Select a partner from the list of unregistered players
    - Confirm → creates a team with both players in `teams` + `team_members`
    - Partner receives a notification: "[Name] registered you for Beer Pong"
    - Once registered, shows "You're teamed up with [Partner]. Waiting for tournament to start..."
  - GM can also manually create pairs from the admin panel

- [ ] **T-17.3 — Bracket generation**
  - When GM sets the challenge to `active`:
    - Edge Function: `generate-bracket`
    - Takes all registered teams, shuffles them, generates a single-elimination bracket
    - Stores the bracket structure in `challenges.metadata`:
      ```json
      {
        "rounds": [
          { "round": 1, "matches": [
            { "id": "m1", "team_a": "team-1", "team_b": "team-2", "winner": null },
            { "id": "m2", "team_a": "team-3", "team_b": "team-4", "winner": null }
          ]},
          { "round": 2, "matches": [
            { "id": "m3", "team_a": null, "team_b": null, "winner": null }
          ]}
        ]
      }
      ```
  - Handle odd numbers: one team gets a bye in round 1

- [ ] **T-17.4 — Player: bracket view**
  - Display the bracket as a visual tree (simple CSS grid or flex layout)
  - Highlight the current player's team
  - Show completed matches with winners, upcoming matches as TBD
  - Realtime updates as the GM logs results

- [ ] **T-17.5 — GM: input match results**
  - Route: `/gm/challenges/beer-pong`
  - For each active match: show team names, "Winner" dropdown, confirm button
  - On confirm: update `challenges.metadata` bracket, advance winner to next round
  - When the final match is decided:
    - Mark challenge as `completed`
    - The winning duo's players are flagged as immune for the first council vote
    - Store immunity in `power_ups` table with `type: 'shield'`, `source: 'challenge'`
    - Notification to winners: "You won Beer Pong! You're immune at the first council."

**Estimated time: 5h**
**Definition of Done:** Players register duos, GM starts the tournament, bracket displays correctly, GM inputs results match by match, winners receive immunity, bracket updates in real time.

---

## PBI-18: Pub Crawl (Saturday Challenge)

> **Goal:** Six teams have pre-assigned bar routes. The GM logs challenge results at each stop. Penalties and rewards are applied.

### Tasks

- [ ] **T-18.1 — Team & route setup**
  - GM creates 6 teams (the 16 players) via the admin panel
  - Each team is assigned a route: an ordered list of bars stored in `teams.metadata`:
    ```json
    {
      "route": [
        { "bar": "Le Petit Nice", "order": 1, "meets_team": "team-bravo", "address": "..." },
        { "bar": "La Caravelle", "order": 2, "meets_team": "team-charlie", "address": "..." },
        { "bar": "Le Trolleybus", "order": 3, "meets_team": "team-delta", "address": "..." }
      ],
      "final_destination": null
    }
    ```
  - The two external friend groups are NOT in the app — they coordinate via WhatsApp with the GM

- [ ] **T-18.2 — Player: pub crawl view**
  - Route: `/challenges/pub-crawl`
  - Shows the player's team route as a step-by-step list:
    - Current bar highlighted, next bar shown, past bars checked off
    - Each bar: name, address (tappable for Google Maps), which other team they'll meet
  - Final destination is hidden until either: the team has won enough clues, or the GM reveals it (failsafe)
  - Simple, mobile-optimized layout — this will be used on the move

- [ ] **T-18.3 — GM: log challenge results**
  - Route: `/gm/challenges/pub-crawl`
  - Per bar stop, per team matchup: "Winner" selector + confirm
  - On win: the team earns a clue toward the final destination
  - Clue logic stored in `challenge_scores`:
    - Each win = +1 clue
    - The final destination is revealed to a team when they reach a clue threshold (e.g., 2 out of 3 wins)
    - OR the GM manually reveals it

- [ ] **T-18.4 — Final destination reveal**
  - When a team has earned enough clues, their pub crawl view updates:
    - "Final destination unlocked!" + name and address of the meeting point
  - For teams that didn't earn enough clues: the GM presses "Reveal destination" → sends it to their view
  - Teams that arrive late or fail entirely: the GM flags them via a "Penalty" toggle → they're marked "on the chopping block" for the next council vote (visual indicator on their profile)

- [ ] **T-18.5 — Arrival tracking & shield reward**
  - The GM has a "Team Arrived" button for each team
  - Arrival order is logged in `challenge_scores`
  - If ALL teams arrive on time: the first team to arrive receives a shield for each member
  - Shields are granted via the existing `power_ups` flow with GM confirmation

- [ ] **T-18.6 — Pub crawl mini-games (generic support)**
  - Since the specific mini-games at each bar are TBD, the app provides a generic structure:
    - GM sees: a match card with two team names and a "Log Result" button (winner/loser/draw)
    - No game-specific UI — the games happen in real life, the app just tracks outcomes
  - This keeps the app flexible regardless of what games are chosen later

**Estimated time: 5h**
**Definition of Done:** Teams see their bar route, GM logs results per stop, clue threshold triggers destination reveal, arrival order is tracked, first team gets shields. Late/losing teams are flagged.

---

## PBI-19: Mad Scientists (Sunday Challenge)

> **Goal:** Per-round role assignment (Scientist vs. Citizen), scoring, and a live leaderboard.

### Tasks

- [ ] **T-19.1 — Challenge setup**
  - GM creates the Mad Scientists challenge and sets the number of rounds (e.g., 3–5)
  - Per round, the GM configures: how many scientists vs. citizens (flexible split)

- [ ] **T-19.2 — Per-round role assignment**
  - Edge Function: `assign-mad-scientist-roles`
  - For each round:
    1. Take all alive + ghost players (ghosts can participate for fun, per design doc)
    2. Randomly assign `scientist` or `citizen` roles for this round
    3. Store assignments in `challenge_scores.metadata`: `{ "mad_role": "scientist" }`
    4. Each player's challenge view updates with their role for this round
  - Roles change randomly every round — no one stays a scientist the whole time

- [ ] **T-19.3 — Player: Mad Scientists view**
  - Route: `/challenges/mad-scientists`
  - Shows:
    - Current round number and your role (Scientist or Citizen), with a dramatic reveal similar to the werewolf role reveal but lighter/faster
    - Role-specific instructions: Scientists must tag citizens with a water pipette; Citizens must find hidden objects
    - Your cumulative score across rounds
    - Leaderboard: all players ranked by total score
  - Between rounds: "Waiting for next round..." screen

- [ ] **T-19.4 — GM: round management & scoring**
  - Route: `/gm/challenges/mad-scientists`
  - Flow per round:
    1. "Assign Roles" button → triggers the Edge Function
    2. Game plays out in real life
    3. GM inputs the winning team (scientists or citizens) for this round
    4. Points are awarded: all members of the winning team get +1 (or configurable points)
    5. "Next Round" button → repeats
  - After the final round: "End Challenge" → marks it as `completed`, leaderboard is finalized

- [ ] **T-19.5 — Leaderboard component**
  - `src/components/Leaderboard.tsx`
  - Reusable across challenges (will also be used on TV view)
  - Props: `scores[]`, `title`
  - Shows: rank, player name, score, highlight for current player
  - Subscribes to Realtime updates on `challenge_scores` for live refresh

**Estimated time: 5h**
**Definition of Done:** GM assigns roles per round, players see their role and instructions, GM logs winning team, scores accumulate, leaderboard updates in real time. Ghosts can participate.

---

## PBI-20: TV Projection View

> **Goal:** A dedicated full-screen browser view for the living room TV, subscribing to real-time events and displaying dramatic results.

### Tasks

- [ ] **T-20.1 — TV route & layout shell**
  - Route: `/tv` (no auth required — it's opened on a shared TV browser)
  - Full-screen layout: dark background, large typography, cinematic feel
  - No interactive elements — this is a display-only view
  - Auto-hides the browser chrome (request fullscreen on click, or instructions to press F11)

- [ ] **T-20.2 — TV: idle / ambient state**
  - Default view when nothing active is happening
  - Shows: event logo ("Les Loups-Garous de Martigues"), alive player count, current game phase
  - Subtle ambient animation: flickering torch effect, floating wolf silhouettes, or a starry night
  - Updates in real time as players are eliminated (count ticks down)

- [ ] **T-20.3 — TV: vote countdown**
  - When a council vote round opens, the TV transitions to:
    - Large countdown timer (MM:SS) with a progress ring or bar
    - "Council is in session" title
    - Live vote progress: "12 / 15 votes cast" (count only, no names)
    - Dramatic audio cue on transition (optional: ambient suspense track)
  - Subscribe to `vote_rounds` (status changes) and `votes` (INSERT count)

- [ ] **T-20.4 — TV: vote results reveal**
  - When the GM resolves a council vote, the TV shows:
    - A dramatic pause (2–3 seconds of tension)
    - Full vote tally: each player's name + who they voted for, revealed one by one or all at once (GM-configurable)
    - The eliminated player's name highlighted in red
    - "The council has spoken." tagline
  - Transition back to idle after 30 seconds (or GM-triggered)

- [ ] **T-20.5 — TV: murder announcement**
  - When the GM confirms a murder, the TV shows:
    - A dark, dramatic screen: "When dawn breaks..."
    - The victim's name revealed: "[Name] was found dead."
    - No role revealed (per game rules)
  - Shorter display than vote results — 10–15 seconds, then back to idle

- [ ] **T-20.6 — TV: challenge leaderboard**
  - The GM can push the current challenge leaderboard to the TV at any time
  - Displays: challenge name, ranked player/team list with scores
  - Uses the same `Leaderboard` component from PBI-19 but with TV-optimized styling (larger fonts, fewer details)

- [ ] **T-20.7 — TV: final reveal**
  - On Monday, when the GM triggers the final reveal:
    - All remaining players' names appear on screen
    - Roles are revealed one by one with a dramatic delay between each
    - Villager = gold card flip, Werewolf = red card flip
    - Final message: "The Villagers win!" or "The Werewolves win!"
    - Confetti animation (or blood splatter, depending on who wins)

- [ ] **T-20.8 — GM: TV scene control**
  - On the GM panel, a "TV Control" section:
    - "Show Leaderboard" → pushes a specific challenge leaderboard
    - "Show Idle" → returns to ambient screen
    - "Show Custom Message" → text input, displayed in large type on TV (for announcements)
    - "Trigger Final Reveal" → launches the reveal sequence
  - Scene changes are pushed via Realtime: write to a `tv_state` key in `game_state.metadata`

- [ ] **T-20.9 — Realtime subscription architecture for TV**
  - The TV view subscribes to:
    - `game_state` → phase changes, TV scene commands
    - `vote_rounds` → round open/close/resolve events
    - `votes` → live count (INSERT events, count only)
    - `eliminations` → murder/vote results
    - `challenge_scores` → leaderboard updates
  - Use a single `useTV()` hook that manages all subscriptions and derives the current scene

**Estimated time: 6h**
**Definition of Done:** The TV view works in a browser, auto-transitions between scenes based on game events, displays vote countdowns and results dramatically, shows leaderboards on demand, and the final reveal sequence plays out. All controlled by the GM.

---

## PBI-21: Sprint 3 Testing

> **Goal:** Validate all Sprint 3 features: power-ups, QR scanning, all three challenges, and the TV view working together with the Sprint 2 gameplay loop.

### Tasks

- [ ] **T-21.1 — Power-ups test scenario**
  - Seed 4 players: 1 GM, 2 villagers, 1 werewolf
  - Grant one villager a shield and a clairvoyance charge (manually via GM panel)
  - Test:
    - [ ] Clairvoyance: player uses it on the werewolf → sees "Werewolf"
    - [ ] Clairvoyance: player uses it on the other villager → sees "Villager"
    - [ ] Shield: werewolf targets the shielded player for murder → GM applies shield → murder blocked
    - [ ] Shield: shielded player is voted out in council → GM applies shield → elimination blocked
    - [ ] Verify consumed power-ups show as "used" in inventory

- [ ] **T-21.2 — QR code test**
  - Generate 3 test reward QR codes (2 shields, 1 clairvoyance) via GM panel
  - Print them (or display on a second screen)
  - Test:
    - [ ] Player scans a valid QR → "Pending GM approval" displayed
    - [ ] GM approves → power-up appears in player's inventory + notification
    - [ ] Player scans an already-claimed QR → error message
    - [ ] Player scans a login QR by mistake → graceful redirect, no crash
    - [ ] GM rejects a scan → QR becomes available again

- [ ] **T-21.3 — Beer Pong tournament test**
  - Register 4 duos (can use test players)
  - Test:
    - [ ] Bracket generates correctly (4 teams → 2 semi-finals + 1 final)
    - [ ] GM inputs semi-final results → bracket updates for all viewers
    - [ ] GM inputs final result → winners receive shield + notification
    - [ ] Bracket handles a bye correctly if odd number of teams

- [ ] **T-21.4 — Pub Crawl test**
  - Create 2 test teams with mock routes (2 bars each)
  - Test:
    - [ ] Each team sees only their own route
    - [ ] GM logs a challenge win → clue count increments
    - [ ] Destination unlocks at threshold
    - [ ] GM manually reveals destination for losing team
    - [ ] GM marks arrival order → first team gets shields
    - [ ] Penalty flag shows on late team's profiles

- [ ] **T-21.5 — Mad Scientists test**
  - Run 2 rounds with 4 test players
  - Test:
    - [ ] Roles assigned randomly each round (not the same split)
    - [ ] Players see their round role immediately
    - [ ] GM logs winning team → scores update
    - [ ] Leaderboard reflects cumulative scores correctly
    - [ ] Ghost players can participate (see role, earn score for fun)

- [ ] **T-21.6 — TV view test**
  - Open `/tv` on a laptop or TV browser
  - Run through a full sequence:
    - [ ] Idle state displays correctly with player count
    - [ ] Opening a council vote → TV transitions to countdown
    - [ ] Vote progress updates live
    - [ ] Resolving the vote → TV shows results with animation
    - [ ] Murder announcement displays correctly
    - [ ] GM pushes leaderboard → TV shows it
    - [ ] GM sends custom message → TV displays it
    - [ ] Final reveal sequence plays out (mock with 3 players)
  - Test on both Chrome and Safari (in case TV is a smart TV browser or cast device)

- [ ] **T-21.7 — Integration test: full evening simulation**
  - Combine everything: start with Beer Pong → council vote → murder → QR scan → verify all flows interact correctly
  - Pay special attention to:
    - [ ] Notifications don't pile up or get lost
    - [ ] TV transitions don't conflict when events happen close together
    - [ ] Power-ups interact correctly with votes and murders

- [ ] **T-21.8 — Bug triage & fixes**
  - Log all issues from above tests
  - P0 fixes before Sprint 3 close
  - P1 issues to Sprint 4 backlog

**Estimated time: 4h**
**Definition of Done:** All power-ups, QR rewards, challenges, and TV view work end-to-end. No conflicts between Sprint 2 gameplay features and Sprint 3 additions. No P0 bugs.

---

## Sprint 3 — Summary

| PBI | Title | Est. Hours | Priority |
|-----|-------|------------|----------|
| PBI-13 | Schema — Power-ups, QR Codes & Challenges | 4h | P0 |
| PBI-14 | Shield Mechanic | 3h | P0 |
| PBI-15 | Clairvoyance Mechanic | 3h | P0 |
| PBI-16 | QR Code Scanning & Rewards | 5h | P0 |
| PBI-17 | Beer Pong Tournament | 5h | P1 |
| PBI-18 | Pub Crawl | 5h | P1 |
| PBI-19 | Mad Scientists | 5h | P1 |
| PBI-20 | TV Projection View | 6h | P1 |
| PBI-21 | Sprint 3 Testing | 4h | P0 |
| | **Total** | **~40h** | |

### Sprint 3 Exit Criteria

- [ ] Shields and clairvoyance work end-to-end with GM confirmation
- [ ] QR codes can be generated, printed, scanned, and approved
- [ ] Beer Pong bracket generates, displays, and resolves with winner rewards
- [ ] Pub Crawl teams see routes, GM logs results, destination reveal works
- [ ] Mad Scientists assigns per-round roles with scoring and leaderboard
- [ ] TV view auto-transitions between scenes based on game events
- [ ] GM has full TV scene control from the admin panel
- [ ] All Sprint 3 features integrate cleanly with Sprint 2 gameplay
- [ ] No P0 bugs remain open