-- Migration: Create qr_codes table for reward QR codes
CREATE TYPE qr_reward_type AS ENUM ('shield', 'clairvoyance');

CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT,
  reward_type qr_reward_type NOT NULL,
  scanned_by UUID REFERENCES players(id),
  scanned_at TIMESTAMPTZ,
  confirmed_by_gm BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read QR codes (to check if already scanned)
CREATE POLICY "anyone_read_qr" ON qr_codes
  FOR SELECT USING (true);

-- Players can update unscanned codes (to claim them)
CREATE POLICY "players_scan_qr" ON qr_codes
  FOR UPDATE USING (scanned_by IS NULL)
  WITH CHECK (true);

-- GM can manage all QR codes
CREATE POLICY "gm_manage_qr" ON qr_codes
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));

-- Allow inserts (for GM creating codes)
CREATE POLICY "allow_insert_qr" ON qr_codes
  FOR INSERT WITH CHECK (true);
