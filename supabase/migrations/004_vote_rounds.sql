-- Migration: Create vote_rounds table
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

-- RLS
ALTER TABLE vote_rounds ENABLE ROW LEVEL SECURITY;

-- All alive players can read council/final rounds; only werewolves read murder rounds
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

-- Only GM can insert/update/delete rounds
CREATE POLICY "gm_manage_rounds"
  ON vote_rounds FOR ALL
  USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
