-- Migration: Create notifications table
CREATE TYPE notification_type AS ENUM (
  'role_assigned', 'vote_open', 'vote_result', 'eliminated',
  'murder_window', 'murder_result', 'infected', 'shield_gained',
  'clairvoyance_gained', 'clairvoyance_result', 'generic'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Players can only read their own notifications
CREATE POLICY "players_read_own_notifications"
  ON notifications FOR SELECT
  USING (player_id::text = auth.uid()::text);

-- Players can mark their own notifications as read
CREATE POLICY "players_update_own_notifications"
  ON notifications FOR UPDATE
  USING (player_id::text = auth.uid()::text)
  WITH CHECK (player_id::text = auth.uid()::text);

-- GM can insert notifications (for broadcasts)
CREATE POLICY "gm_manage_notifications"
  ON notifications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
