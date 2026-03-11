-- Enable Realtime on both tables
ALTER PUBLICATION supabase_realtime ADD TABLE players, game_state;
