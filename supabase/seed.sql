-- Seed: 16 players + 1 GM
-- Run this in the Supabase SQL Editor to populate test data

-- GM account
INSERT INTO players (name, auth_token, is_gm, status) VALUES
  ('Milou', 'gm-master-2026', TRUE, 'alive');

-- 16 players (replace names with actual player names)
INSERT INTO players (name, auth_token, status) VALUES
  ('Lilouxinoux',  'token-player-01', 'pending'),
  ('Emmapffrt',  'token-player-02', 'pending'),
  ('Loulou',  'token-player-03', 'pending'),
  ('Jonâtre',  'token-player-04', 'pending'),
  ('Graugustin',  'token-player-05', 'pending'),
  ('Paulo',  'token-player-06', 'pending'),
  ('Clacla',  'token-player-07', 'pending'),
  ('Cochette',  'token-player-08', 'pending'),
  ('Dalouche',  'token-player-09', 'pending'),
  ('Dreydrey', 'token-player-10', 'pending'),
  ('Lilou (la nulle)', 'token-player-11', 'pending'),
  ('Mel', 'token-player-12', 'pending'),
  ('Omuking', 'token-player-13', 'pending'),
  ('Deb', 'token-player-14', 'pending'),
  ('Fafa', 'token-player-15', 'pending'),
  ('Taïre', 'token-player-16', 'pending');
