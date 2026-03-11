-- Enable Realtime on Sprint 2 tables
ALTER PUBLICATION supabase_realtime ADD TABLE vote_rounds, votes, eliminations, notifications;
