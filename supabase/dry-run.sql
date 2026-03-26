-- Seed: 16 players + 1 GM
-- Run this in the Supabase SQL Editor to populate test data

-- GM account
INSERT INTO players (name, auth_token, is_gm, status) VALUES
  ('Milou', 'gm-master-2026', TRUE, 'alive');

-- 16 players (replace names with actual player names)
INSERT INTO players (name, auth_token, status) VALUES
  ('Lilouxinoux',  'token-player-01', 'pending'),
  ("Gogo l'asticot",  'token-player-02', 'pending'),
  ('Adirène',  'token-player-03', 'pending');
