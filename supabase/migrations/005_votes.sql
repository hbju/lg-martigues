-- Migration: Create votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES vote_rounds(id) NOT NULL,
  voter_id UUID REFERENCES players(id) NOT NULL,
  target_id UUID REFERENCES players(id) NOT NULL,
  is_random BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(round_id, voter_id)  -- one vote per player per round
);

-- RLS
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
