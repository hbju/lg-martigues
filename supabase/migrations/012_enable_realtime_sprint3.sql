-- Enable Realtime on Sprint 3 tables
ALTER PUBLICATION supabase_realtime
  ADD TABLE power_ups, qr_codes, challenges, challenge_scores, teams, team_members;
