-- Migration: Create game_state table
CREATE TYPE game_phase AS ENUM (
  'setup', 'role_reveal', 'playing', 'final_vote', 'finished'
);

CREATE TABLE game_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phase game_phase DEFAULT 'setup',
  current_round INT DEFAULT 0,
  is_final_vote BOOLEAN DEFAULT FALSE,
  werewolf_count INT DEFAULT 3,
  villager_count INT DEFAULT 13,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert singleton row
INSERT INTO game_state (id) VALUES (1);

-- RLS
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

-- Everyone can read game state
CREATE POLICY "anyone_read_game_state"
  ON game_state FOR SELECT
  USING (true);

-- Allow updates (GM will update via app)
CREATE POLICY "allow_update_game_state"
  ON game_state FOR UPDATE
  USING (true);
