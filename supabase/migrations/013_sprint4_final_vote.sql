-- Sprint 4: Final Vote & Data Integrity

-- Add 'final_vote' to elimination_method if not already present
-- (Already in the enum from 006_eliminations.sql)

-- Add game result tracking columns
-- game_state.metadata already stores JSON, so we'll use it for:
-- { "winner": "villagers"|"werewolves", "survivors": [...], "tv_state": {...} }

-- Data integrity: ghost cannot be murder target
CREATE OR REPLACE FUNCTION check_vote_target_alive()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = NEW.target_id AND status = 'alive'
  ) THEN
    RAISE EXCEPTION 'Target player is not alive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vote_target_alive
  BEFORE INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION check_vote_target_alive();

-- Data integrity: ghost cannot cast a vote
CREATE OR REPLACE FUNCTION check_voter_alive()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = NEW.voter_id AND status = 'alive'
  ) THEN
    RAISE EXCEPTION 'Voter is not alive';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_voter_alive
  BEFORE INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION check_voter_alive();

-- Sync werewolf_count on player role/status change
CREATE OR REPLACE FUNCTION sync_game_counts()
RETURNS TRIGGER AS $$
DECLARE
  wc INT;
  vc INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE role = 'werewolf' AND status = 'alive'),
    COUNT(*) FILTER (WHERE role = 'villager' AND status = 'alive')
  INTO wc, vc
  FROM players
  WHERE NOT is_gm;

  UPDATE game_state
  SET werewolf_count = wc,
      villager_count = vc,
      updated_at = now()
  WHERE id = 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_game_counts
  AFTER UPDATE OF role, status ON players
  FOR EACH ROW
  EXECUTE FUNCTION sync_game_counts();

-- Error logs table for error boundary reporting
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_insert_errors" ON error_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "gm_read_errors" ON error_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE error_logs;
