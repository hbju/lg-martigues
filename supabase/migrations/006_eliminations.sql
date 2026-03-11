-- Migration: Create eliminations table
CREATE TYPE elimination_method AS ENUM ('voted', 'murdered', 'random', 'final_vote');

CREATE TABLE eliminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) NOT NULL,
  round_id UUID REFERENCES vote_rounds(id),
  method elimination_method NOT NULL,
  confirmed_by_gm BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE eliminations ENABLE ROW LEVEL SECURITY;

-- All players can read confirmed eliminations
CREATE POLICY "players_read_confirmed_eliminations"
  ON eliminations FOR SELECT
  USING (confirmed_by_gm = true);

-- GM can read all eliminations
CREATE POLICY "gm_read_all_eliminations"
  ON eliminations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));

-- GM can manage eliminations
CREATE POLICY "gm_manage_eliminations"
  ON eliminations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
