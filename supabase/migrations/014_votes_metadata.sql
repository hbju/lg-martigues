-- Migration: Add metadata column to votes table (for continue_poll choice encoding)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
