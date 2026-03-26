-- Migration: Supabase Auth integration
-- Creates auth users with UUIDs matching player UUIDs so auth.uid() works for RLS.
-- Requires pgcrypto (already available in Supabase).

-- 1. Function to provision a Supabase Auth user for a player
CREATE OR REPLACE FUNCTION provision_auth_user(
  p_player_id UUID,
  p_email TEXT,
  p_password TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Only create if the auth user doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_player_id) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      p_player_id,
      'authenticated',
      'authenticated',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_player_id,
      jsonb_build_object('sub', p_player_id::text, 'email', p_email),
      'email',
      p_player_id::text,
      now(),
      now(),
      now()
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Public RPC: login with game token → provisions auth user → returns email for signIn
CREATE OR REPLACE FUNCTION login_with_token(p_token TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player RECORD;
  v_email TEXT;
BEGIN
  -- Find the player by auth_token
  SELECT id, name, is_gm INTO v_player
  FROM players
  WHERE auth_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  -- Derive a stable email from the player UUID
  v_email := v_player.id::text || '@lg-martigues.local';

  -- Provision the Supabase Auth user (idempotent)
  PERFORM provision_auth_user(v_player.id, v_email, p_token);

  RETURN json_build_object(
    'player_id', v_player.id,
    'email', v_email,
    'is_gm', v_player.is_gm
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Function to update auth password when GM regenerates a token
CREATE OR REPLACE FUNCTION update_auth_password(p_player_id UUID, p_new_password TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Tighten RLS on players table — now that auth.uid() works
-- Drop the old overly-permissive policies
DROP POLICY IF EXISTS "players_read_own" ON players;
DROP POLICY IF EXISTS "gm_update_players" ON players;
DROP POLICY IF EXISTS "allow_insert_players" ON players;

-- All authenticated users can read basic player info (needed for lobby, votes, leaderboard)
CREATE POLICY "authenticated_read_players" ON players
  FOR SELECT USING (true);

-- GM can manage players
CREATE POLICY "gm_manage_players" ON players
  FOR ALL USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));

-- Players can update only their own record (for marking notifications read, etc.)
CREATE POLICY "players_update_own" ON players
  FOR UPDATE USING (id::text = auth.uid()::text);

-- Allow inserts for seeding (will be done before auth is set up)
CREATE POLICY "allow_insert_players" ON players
  FOR INSERT WITH CHECK (true);

-- 5. Tighten other overly-permissive policies

-- game_state: keep reads open, restrict updates to GM
DROP POLICY IF EXISTS "allow_update_game_state" ON game_state;
CREATE POLICY "gm_update_game_state" ON game_state
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));

-- power_ups: restrict inserts/updates to GM
DROP POLICY IF EXISTS "allow_insert_powerups" ON power_ups;
DROP POLICY IF EXISTS "allow_update_powerups" ON power_ups;
CREATE POLICY "gm_insert_powerups" ON power_ups
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));
CREATE POLICY "gm_update_powerups" ON power_ups
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM players WHERE id::text = auth.uid()::text AND is_gm = true
  ));

-- qr_codes: restrict inserts to GM (drop the open one)
DROP POLICY IF EXISTS "allow_insert_qr" ON qr_codes;

-- challenges: restrict inserts/updates to GM
DROP POLICY IF EXISTS "allow_insert_challenges" ON challenges;
DROP POLICY IF EXISTS "allow_update_challenges" ON challenges;

-- challenge_scores: restrict inserts to GM
DROP POLICY IF EXISTS "allow_insert_scores" ON challenge_scores;
DROP POLICY IF EXISTS "allow_update_scores" ON challenge_scores;

-- teams: restrict inserts/updates to GM
DROP POLICY IF EXISTS "allow_insert_teams" ON teams;
DROP POLICY IF EXISTS "allow_update_teams" ON teams;

-- team_members: restrict inserts/deletes to GM
DROP POLICY IF EXISTS "allow_insert_team_members" ON team_members;
DROP POLICY IF EXISTS "allow_delete_team_members" ON team_members;
