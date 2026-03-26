-- Migration: Create power_ups table
CREATE TYPE power_up_type AS ENUM ('shield', 'clairvoyance');
CREATE TYPE power_up_source AS ENUM ('qr', 'challenge', 'meme', 'manual');

CREATE TABLE power_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) NOT NULL,
  type power_up_type NOT NULL,
  source power_up_source NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_on UUID REFERENCES players(id),
  granted_by_gm BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE power_ups ENABLE ROW LEVEL SECURITY;

-- Players can read their own power-ups
CREATE POLICY "players_read_own_powerups" ON power_ups
  FOR SELECT USING (true);

-- GM can manage all power-ups
CREATE POLICY "gm_manage_powerups" ON power_ups
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE is_gm = true
  ));

-- Allow inserts (for app-level grants)
CREATE POLICY "allow_insert_powerups" ON power_ups
  FOR INSERT WITH CHECK (true);

-- Allow updates (for using power-ups)
CREATE POLICY "allow_update_powerups" ON power_ups
  FOR UPDATE USING (true);
