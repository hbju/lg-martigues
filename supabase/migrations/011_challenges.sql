-- Migration: Create challenges, challenge_scores, teams, team_members tables
CREATE TYPE challenge_type AS ENUM ('beer_pong', 'pub_crawl', 'mad_scientists');
CREATE TYPE challenge_status AS ENUM ('upcoming', 'active', 'completed');

CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type challenge_type NOT NULL,
  status challenge_status DEFAULT 'upcoming',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE challenge_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) NOT NULL,
  player_id UUID REFERENCES players(id),
  team_id TEXT,
  round_number INT,
  score INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  challenge_id UUID REFERENCES challenges(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE team_members (
  team_id TEXT REFERENCES teams(id),
  player_id UUID REFERENCES players(id),
  PRIMARY KEY (team_id, player_id)
);

-- RLS for challenges
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY "gm_manage_challenges" ON challenges
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
CREATE POLICY "allow_insert_challenges" ON challenges
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update_challenges" ON challenges
  FOR UPDATE USING (true);

-- RLS for challenge_scores
ALTER TABLE challenge_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_scores" ON challenge_scores FOR SELECT USING (true);
CREATE POLICY "gm_manage_scores" ON challenge_scores
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
CREATE POLICY "allow_insert_scores" ON challenge_scores
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update_scores" ON challenge_scores
  FOR UPDATE USING (true);

-- RLS for teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_teams" ON teams FOR SELECT USING (true);
CREATE POLICY "gm_manage_teams" ON teams
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
CREATE POLICY "allow_insert_teams" ON teams
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update_teams" ON teams
  FOR UPDATE USING (true);

-- RLS for team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_read_team_members" ON team_members FOR SELECT USING (true);
CREATE POLICY "gm_manage_team_members" ON team_members
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
CREATE POLICY "allow_insert_team_members" ON team_members
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_delete_team_members" ON team_members
  FOR DELETE USING (true);
