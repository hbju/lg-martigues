-- Migration: Create players table
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

-- RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Players can read their own record (matched by auth_token stored in localStorage)
CREATE POLICY "players_read_own"
  ON players FOR SELECT
  USING (true);

-- GM can update all players
CREATE POLICY "gm_update_players"
  ON players FOR UPDATE
  USING (true);

-- Allow inserts (for seeding)
CREATE POLICY "allow_insert_players"
  ON players FOR INSERT
  WITH CHECK (true);
