# 🐺 Sprint 2 — Core Gameplay

**Sprint Goal:** The full vote/murder/elimination loop works. The game is playable end-to-end: council votes, werewolf kills, infection, ghost mode, and real-time notifications.

**Duration:** March 10–16, 2026
**Estimated Total:** ~40 hours

---

## PBI-6: Supabase Schema — Votes, Eliminations & Notifications

> **Goal:** The database tables powering the voting, elimination, and notification systems exist, with RLS enforced and Realtime enabled.

### Tasks

- [ ] **T-6.1 — Create migration: `vote_rounds` table**
  ```sql
  -- supabase/migrations/002_votes.sql
  CREATE TYPE vote_round_type AS ENUM ('council', 'murder', 'final');
  CREATE TYPE vote_round_status AS ENUM ('open', 'closed', 'resolved');

  CREATE TABLE vote_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type vote_round_type NOT NULL,
    status vote_round_status DEFAULT 'open',
    timer_duration_seconds INT NOT NULL DEFAULT 900,
    timer_started_at TIMESTAMPTZ,
    timer_end_at TIMESTAMPTZ,
    created_by UUID REFERENCES players(id),
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-6.2 — Create migration: `votes` table**
  ```sql
  CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID REFERENCES vote_rounds(id) NOT NULL,
    voter_id UUID REFERENCES players(id) NOT NULL,
    target_id UUID REFERENCES players(id) NOT NULL,
    is_random BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(round_id, voter_id)  -- one vote per player per round
  );
  ```

- [ ] **T-6.3 — Create migration: `eliminations` table**
  ```sql
  CREATE TYPE elimination_method AS ENUM ('voted', 'murdered', 'random', 'final_vote');

  CREATE TABLE eliminations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) NOT NULL,
    round_id UUID REFERENCES vote_rounds(id),
    method elimination_method NOT NULL,
    confirmed_by_gm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-6.4 — Create migration: `notifications` table**
  ```sql
  CREATE TYPE notification_type AS ENUM (
    'role_assigned', 'vote_open', 'vote_result', 'eliminated',
    'murder_window', 'murder_result', 'infected', 'shield_gained',
    'clairvoyance_gained', 'clairvoyance_result', 'generic'
  );

  CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) NOT NULL,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] **T-6.5 — RLS policies for `vote_rounds`**
  ```sql
  ALTER TABLE vote_rounds ENABLE ROW LEVEL SECURITY;

  -- All alive players can read council rounds; only werewolves read murder rounds
  CREATE POLICY "players_read_council_rounds"
    ON vote_rounds FOR SELECT
    USING (
      type = 'council' OR type = 'final'
      OR (type = 'murder' AND EXISTS (
        SELECT 1 FROM players
        WHERE id::text = auth.uid()::text
        AND role = 'werewolf' AND status = 'alive'
      ))
    );

  -- GM can read all rounds
  CREATE POLICY "gm_read_all_rounds"
    ON vote_rounds FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));

  -- Only GM can insert/update rounds
  CREATE POLICY "gm_manage_rounds"
    ON vote_rounds FOR ALL
    USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));
  ```

- [ ] **T-6.6 — RLS policies for `votes`**
  ```sql
  ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

  -- Players can insert their own vote (only in open rounds)
  CREATE POLICY "players_cast_vote"
    ON votes FOR INSERT
    WITH CHECK (
      voter_id::text = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM vote_rounds WHERE id = round_id AND status = 'open'
      )
    );

  -- Players can read votes only after round is resolved
  CREATE POLICY "players_read_resolved_votes"
    ON votes FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM vote_rounds WHERE id = round_id AND status = 'resolved'
      )
    );

  -- GM can read all votes at any time
  CREATE POLICY "gm_read_all_votes"
    ON votes FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
    ));
  ```

- [ ] **T-6.7 — RLS policies for `notifications`**
  ```sql
  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

  -- Players can only read their own notifications
  CREATE POLICY "players_read_own_notifications"
    ON notifications FOR SELECT
    USING (player_id::text = auth.uid()::text);

  -- Players can mark their own notifications as read
  CREATE POLICY "players_update_own_notifications"
    ON notifications FOR UPDATE
    USING (player_id::text = auth.uid()::text)
    WITH CHECK (player_id::text = auth.uid()::text);
  ```

- [ ] **T-6.8 — Enable Realtime on new tables**
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE vote_rounds, votes, eliminations, notifications;
  ```

- [ ] **T-6.9 — Regenerate TypeScript types**
  ```bash
  supabase gen types typescript --linked > src/types/supabase.ts
  ```

**Estimated time: 4h**
**Definition of Done:** All four tables exist with RLS. Manual inserts confirm policies block unauthorized access. Realtime enabled. Types regenerated.

---

## PBI-7: Council Voting (Round Tables)

> **Goal:** The GM can open a council vote with a timer. All alive players vote for someone. Votes resolve automatically or on timer expiry.

### Tasks

- [ ] **T-7.1 — Game state store (Zustand)**
  - `src/stores/gameStore.ts`
  - State: `gamePhase`, `currentRound` (active vote_round or null), `alivePlayers[]`, `eliminatedPlayers[]`
  - Actions: `subscribeToGameState()`, `subscribeToCurrentRound()`
  - Realtime subscriptions to `game_state` and `vote_rounds` tables

- [ ] **T-7.2 — GM: open vote round**
  - Route: `/gm/votes`
  - "Open Council Vote" button → creates a `vote_rounds` row with:
    - `type: 'council'`
    - `status: 'open'`
    - `timer_duration_seconds`: configurable (default 900 = 15 min)
    - `timer_started_at`: now
    - `timer_end_at`: now + duration
  - GM sees a live dashboard of who has voted (count only, not targets) while the round is open

- [ ] **T-7.3 — Player: vote screen**
  - When a council round opens, all alive players are redirected to the vote screen
  - Shows: list of all alive players (excluding self), a countdown timer, and a "Confirm Vote" button
  - Flow:
    1. Player taps a name → name is highlighted
    2. Player taps "Confirm Vote" → confirmation modal ("Vote to eliminate [Name]?")
    3. On confirm → `INSERT INTO votes (round_id, voter_id, target_id)`
    4. After voting, show "Vote cast. Waiting for others..." with the countdown still visible
  - A player CANNOT change their vote after confirming

- [ ] **T-7.4 — Countdown timer component**
  - `src/components/ui/CountdownTimer.tsx`
  - Props: `endTime: Date`, `onExpire: () => void`
  - Displays MM:SS, turns red under 60s, pulses under 10s
  - Uses `date-fns` for calculations, `requestAnimationFrame` for smooth ticking
  - The timer is cosmetic — the server is the source of truth for expiry

- [ ] **T-7.5 — Vote resolution Edge Function**
  - Supabase Edge Function: `resolve-council-vote`
  - Triggered by: GM manually pressing "Close Vote" OR a scheduled check on timer expiry
  - Logic:
    1. Fetch all votes for this round
    2. Find alive players who haven't voted → assign random targets for them, with `is_random = true`
    3. Tally votes: the player with the most votes is the elimination candidate
    4. Handle ties: GM chooses, or random among tied players (configurable)
    5. Set `vote_rounds.status = 'resolved'`
    6. Insert an `eliminations` row with `method: 'voted'`, `confirmed_by_gm: false`
    7. Send notifications to all players with their individual vote info
  - Security: only callable by GM

- [ ] **T-7.6 — Timer expiry handling**
  - Option A (recommended for simplicity): GM manually closes the round when the timer is up. The countdown on players' screens is a visual cue, not an auto-trigger.
  - Option B (stretch): Supabase `pg_cron` job or a Vercel cron that checks for expired rounds every 30s and auto-resolves them.
  - For Sprint 2, go with **Option A**. Add a prominent "Timer expired — close vote now" alert on the GM panel.

- [ ] **T-7.7 — Vote results screen**
  - After round resolution, each player's screen shows:
    - "You voted for: [Name]" (or "Your vote was randomly assigned to: [Name]" if they didn't vote)
    - The total number of votes (but NOT who voted for whom — only the GM and the TV see the full tally)
  - The GM sees the full breakdown: each voter → target mapping
  - The eliminated player's name is announced

- [ ] **T-7.8 — GM: confirm elimination**
  - After resolution, the GM sees the result and an "Confirm Elimination" button
  - On confirm:
    - `eliminations.confirmed_by_gm = true`
    - `players.status = 'ghost'` for the eliminated player
    - Notification sent to the eliminated player: "You have been eliminated by the council."
    - Notification sent to all: "[Name] has been eliminated."
  - The eliminated player's **role is NOT revealed** by the app

- [ ] **T-7.9 — Realtime vote progress hook**
  - `src/hooks/useVoteProgress.ts`
  - Subscribes to `INSERT` on `votes` table filtered by current `round_id`
  - Returns: `{ totalVoters, votedCount, hasCurrentPlayerVoted }`
  - Used by both the player vote screen (progress bar) and the GM panel

**Estimated time: 10h**
**Definition of Done:** GM opens a vote → all players see the vote screen with timer → players vote → timer expires → GM closes the round → results displayed per-player → GM confirms elimination → player becomes Ghost.

---

## PBI-8: Werewolf Murder System

> **Goal:** Werewolves have a private channel to coordinate kills. All must agree unanimously. Failure results in a random elimination.

### Tasks

- [ ] **T-8.1 — Werewolf private view**
  - Route: `/werewolf`
  - Only accessible to players with `role = 'werewolf'` and `status = 'alive'` (route guard)
  - After the discovery phase (meeting in person), this becomes the coordination hub
  - Shows: list of fellow werewolves (names only — they already met in person), current murder window status

- [ ] **T-8.2 — GM: open murder window**
  - On the GM panel, "Open Murder Window" button → creates a `vote_rounds` row with:
    - `type: 'murder'`
    - `status: 'open'`
    - `timer_duration_seconds`: configurable (default varies by context — pub crawl window is longer)
  - Notifications sent to all living werewolves: "The hunt begins. Choose your target."

- [ ] **T-8.3 — Werewolf: murder vote screen**
  - Similar to council vote screen, but:
    - Only living werewolves can see and interact with it
    - Target list includes ALL alive players (including other werewolves — per the design doc, a random elimination could hit a werewolf)
    - Each werewolf selects a target and confirms
  - UI shows: who among the werewolves has voted (without revealing their choice), countdown timer

- [ ] **T-8.4 — Murder resolution Edge Function**
  - Supabase Edge Function: `resolve-murder`
  - Logic:
    1. Fetch all votes for this murder round
    2. Check unanimity: do ALL living werewolves' votes point to the same target?
       - **Yes → unanimous kill**: create `eliminations` row with `method: 'murdered'`
       - **No → disagreement**: select a random player from ALL alive players (werewolves included), create `eliminations` row with `method: 'random'`
    3. If timer expires with missing votes: treat missing votes as disagreement → random elimination
    4. Set round status to `'resolved'`
    5. Notifications:
       - To werewolves: "Kill successful: [Name]" or "You failed to agree. A random elimination has occurred."
       - To the victim: sent only after GM confirmation
  - Security: only callable by GM

- [ ] **T-8.5 — GM: confirm murder**
  - GM sees the murder result (target + method) and confirms
  - On confirm:
    - `players.status = 'ghost'` for the victim
    - Notification to the victim: "You were killed in the night." (or appropriate timing message)
    - Notification to all players: "[Name] has been found dead."
  - The timing of notification delivery is controlled by the GM (e.g., announced at breakfast, not at 3 AM)

- [ ] **T-8.6 — Werewolf discovery phase handling**
  - After role assignment, werewolves don't know each other (they meet physically)
  - In the app, werewolves can see the `/werewolf` route but it initially says: "Find your fellow wolves at the meeting point. Once you've met, the GM will unlock your pack."
  - GM has a toggle: "Confirm werewolf discovery" → enables the full werewolf channel (vote coordination, teammate list)
  - This prevents a werewolf from seeing teammates' names in the app before the in-person meeting

- [ ] **T-8.7 — Werewolf count tracking**
  - After each elimination, check if the eliminated player was a werewolf
  - Update `game_state.werewolf_count` accordingly
  - This count drives the infection mechanic (PBI-9)

**Estimated time: 10h**
**Definition of Done:** GM opens a murder window → werewolves see private vote screen → they vote → unanimity check resolves correctly → GM confirms kill → victim becomes Ghost. Disagreement correctly triggers random elimination.

---

## PBI-9: Infection Mechanic

> **Goal:** When a werewolf elimination leaves a single surviving werewolf, they can recruit a villager.

### Tasks

- [ ] **T-9.1 — Lone werewolf detection**
  - After every elimination (council or murder), run a check:
    - Count `players WHERE role = 'werewolf' AND status = 'alive'`
    - If count === 1 AND `game_state.phase !== 'final_vote'` (not Monday):
      - Trigger infection flow
  - This check lives in the elimination confirmation Edge Function (triggered after GM confirms)

- [ ] **T-9.2 — Infection Edge Function**
  - Supabase Edge Function: `trigger-infection`
  - Logic:
    1. Identify the lone werewolf
    2. Send them a notification: "You are the last wolf. Choose someone to join your pack."
    3. Set a flag on `game_state.metadata`: `{ infection_pending: true, infector_id: <wolf_id> }`
  - The lone werewolf's app shows a special "Infect" screen

- [ ] **T-9.3 — Werewolf: infection target selection**
  - On the werewolf's `/werewolf` route, a new panel appears: "Choose a player to corrupt"
  - Lists all alive villagers
  - The werewolf selects one and confirms → writes to `game_state.metadata`: `{ infection_target: <player_id> }`
  - Shows "Waiting for GM confirmation..."

- [ ] **T-9.4 — GM: confirm infection**
  - GM panel shows: "[Wolf name] wants to infect [Target name]"
  - "Confirm" button:
    1. Update target player: `role = 'werewolf'`
    2. Update `game_state.werewolf_count` (increment by 1)
    3. Clear `infection_pending` flag
    4. Notify the new werewolf: "You have been corrupted. You are now a Werewolf. Your teammate is [Wolf name]."
    5. Notify the original werewolf: "[Target name] has joined the pack."
  - "Reject" button: clears the pending state, lets the werewolf pick again

- [ ] **T-9.5 — Update werewolf channel access**
  - After infection, the new werewolf gains access to the `/werewolf` route
  - RLS policy update: the newly infected player can now see murder rounds
  - The werewolf list on the private channel updates to include the new member

**Estimated time: 4h**
**Definition of Done:** Eliminating a werewolf to leave one survivor triggers the infection flow. The lone wolf picks a target, GM confirms, the target becomes a werewolf with full channel access and both are notified.

---

## PBI-10: Ghost Mode

> **Goal:** Eliminated players transition to a spectator experience. They can see the game progress but cannot participate in votes.

### Tasks

- [ ] **T-10.1 — Ghost UI theme**
  - When `player.status === 'ghost'`, apply a global CSS class to the app shell
  - Visual changes: desaturated color palette, semi-transparent overlays, a subtle ghost icon in the header
  - All interactive vote/murder elements are hidden or disabled

- [ ] **T-10.2 — Ghost route guard**
  - `<GhostGuard>` component (already scaffolded in Sprint 1)
  - Blocks access to: `/vote`, `/werewolf`
  - Allows access to: `/home`, `/challenges`, `/notifications`
  - Shows a friendly message if they try to access a blocked route: "The dead watch, but do not speak."

- [ ] **T-10.3 — Ghost home dashboard**
  - Modified home view showing:
    - "You are a Ghost" status badge
    - Current game phase and alive player count
    - Challenge scores (read-only)
    - Notification feed (they still receive announcements)
  - No vote buttons, no action items

- [ ] **T-10.4 — Ghost elimination announcement**
  - When a player is eliminated, the app handles the transition:
    1. A full-screen overlay: "You have been eliminated." (with context: "by the council" or "by the werewolves")
    2. Option to "reveal" their role verbally (the app shows a reminder: "You may choose to tell others your role. The app will not reveal it.")
    3. Dismiss → transition to Ghost mode

**Estimated time: 3h**
**Definition of Done:** An eliminated player sees the elimination overlay, transitions to Ghost mode with the desaturated theme, cannot access voting, and can still browse challenges and receive notifications.

---

## PBI-11: Notification System

> **Goal:** Players receive real-time in-app notifications for all game events. A notification bell with unread count is always visible.

### Tasks

- [ ] **T-11.1 — Notification store (Zustand)**
  - `src/stores/notificationStore.ts`
  - State: `notifications[]`, `unreadCount`
  - Actions: `subscribe()`, `markAsRead(id)`, `markAllAsRead()`
  - Realtime subscription to `notifications` table filtered by current player ID

- [ ] **T-11.2 — Toast component**
  - `src/components/ui/Toast.tsx`
  - Appears at the top of the screen when a new notification arrives
  - Auto-dismisses after 5 seconds, or tap to dismiss
  - Shows: icon (based on notification type), title, truncated message
  - Tapping the toast opens the notification panel

- [ ] **T-11.3 — Notification bell**
  - In the app header (visible on all screens): a bell icon with unread count badge
  - Tapping opens a slide-out panel with the full notification list
  - Each notification: icon, title, message, timestamp, read/unread indicator
  - "Mark all as read" button at the top

- [ ] **T-11.4 — Notification triggers**
  - Integrate notification creation into all existing Edge Functions:
    - `assign-roles` → "Your role has been assigned. Check it now."
    - `resolve-council-vote` → "The council has spoken." + individual vote info
    - `resolve-murder` → (to victim, after GM confirms) "You were killed."
    - `trigger-infection` → "You are the last wolf." / "You have been corrupted."
    - Elimination confirmation → "You have been eliminated." / "[Name] was eliminated."
  - Also insert notifications from GM actions (manual shield grants, announcements)

- [ ] **T-11.5 — GM: broadcast notification**
  - On the GM panel, a "Send Announcement" feature:
    - Text input for title and message
    - Target: all players, alive only, ghosts only, or a specific player
    - Inserts notification rows for each target player
  - Useful for custom announcements ("Breakfast is ready!", "Pub crawl starts in 30 min")

- [ ] **T-11.6 — Sound / vibration cue**
  - When a notification arrives while the app is in the foreground:
    - Play a short sound effect (a subtle wolf howl or chime)
    - Trigger device vibration via `navigator.vibrate(200)` (if supported)
  - Respect a "Mute" toggle in the app settings

**Estimated time: 5h**
**Definition of Done:** Notifications fire for all game events, appear as toasts in real time, accumulate in the notification panel with unread badges, and the GM can broadcast custom messages.

---

## PBI-12: Sprint 2 Testing — Full Game Simulation

> **Goal:** Run a complete game loop with 3–5 testers to validate the entire Sprint 2 feature set.

### Tasks

- [ ] **T-12.1 — Test scenario setup**
  - Seed 5 test players: 1 GM, 3 villagers, 1 werewolf
  - Prepare a scripted scenario:
    1. All players log in, roles assigned
    2. Council vote → one villager eliminated → becomes Ghost
    3. Murder window → werewolf kills a villager
    4. Simulate lone wolf → infection flow
    5. Second council vote with infected player now a werewolf
    6. Verify notifications at every step

- [ ] **T-12.2 — Multi-device live test**
  - Minimum 3 physical devices + 1 laptop (for GM)
  - Run through the full scripted scenario
  - Test on both Android Chrome and iOS Safari
  - Verify:
    - [ ] Council vote opens and all devices receive it within 2 seconds
    - [ ] Votes are correctly recorded and tallied
    - [ ] Random vote assignment works when timer expires
    - [ ] Murder unanimity check passes and fails correctly
    - [ ] Random elimination on murder disagreement works
    - [ ] Infection flow triggers at the right moment
    - [ ] Ghost mode activates properly, blocks voting
    - [ ] All notifications arrive and display correctly
    - [ ] No data leaks (villager cannot see werewolf channel, player cannot see others' votes before resolution)

- [ ] **T-12.3 — Edge case testing**
  - [ ] What happens if a player disconnects mid-vote?
  - [ ] What happens if the GM opens two vote rounds simultaneously? (should be blocked)
  - [ ] What if a werewolf votes for another werewolf in murder? (allowed per design — random elimination risk)
  - [ ] What if the last werewolf is eliminated? (game should be flaggable as villager victory)
  - [ ] Session recovery: close and reopen the app mid-vote — does it restore correctly?

- [ ] **T-12.4 — Performance check**
  - Realtime latency: measure time from GM action to player screen update
  - Target: under 2 seconds on Wi-Fi, under 5 seconds on mobile data
  - Check for WebSocket disconnection/reconnection behavior

- [ ] **T-12.5 — Bug triage & fixes**
  - Log all issues
  - Fix P0 (game-breaking) before Sprint 2 close
  - Carry P1 to Sprint 3 backlog

**Estimated time: 4h**
**Definition of Done:** A complete game loop (vote → eliminate → murder → infect → ghost) runs successfully across multiple devices. No P0 bugs. Notifications work end-to-end.

---

## Sprint 2 — Summary

| PBI | Title | Est. Hours | Priority |
|-----|-------|------------|----------|
| PBI-6 | Schema — Votes, Eliminations & Notifications | 4h | P0 |
| PBI-7 | Council Voting (Round Tables) | 10h | P0 |
| PBI-8 | Werewolf Murder System | 10h | P0 |
| PBI-9 | Infection Mechanic | 4h | P1 |
| PBI-10 | Ghost Mode | 3h | P1 |
| PBI-11 | Notification System | 5h | P0 |
| PBI-12 | Sprint 2 Testing — Full Game Simulation | 4h | P0 |
| | **Total** | **~40h** | |

### Sprint 2 Exit Criteria

- [ ] A council vote can be opened, cast, resolved, and confirmed end-to-end
- [ ] Werewolves can coordinate a private murder vote with unanimity enforcement
- [ ] Random elimination triggers correctly on werewolf disagreement
- [ ] Infection flow works when a lone werewolf remains
- [ ] Eliminated players transition to Ghost mode cleanly
- [ ] Notifications fire in real time for every game event
- [ ] The GM has full control over vote rounds, murders, infection, and can broadcast messages
- [ ] A scripted full game loop has been run successfully on real devices
- [ ] No P0 bugs remain open

### Sprint 2 Risk Notes

- **This is the heaviest sprint (~40h).** If time runs short, PBI-9 (Infection) and PBI-10 (Ghost Mode) are P1 and can slip to Sprint 3 — the game is testable without them.
- **Vote timer handling:** Start with GM-manual close (Option A). Auto-expiry via cron is a nice-to-have for Sprint 4 polish.
- **RLS complexity increases significantly.** Test policies thoroughly — a single misconfigured policy could leak werewolf identities or vote targets.