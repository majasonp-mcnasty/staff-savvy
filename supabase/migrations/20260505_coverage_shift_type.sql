-- Migration: coverage_requirements shift_type + is_active, stations min_seniority_level
-- Run this in: Supabase Dashboard → SQL Editor

-- 1. coverage_requirements: new columns
ALTER TABLE coverage_requirements
  ADD COLUMN IF NOT EXISTS shift_type text NOT NULL DEFAULT 'morning',
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;

-- 2. Backfill shift_type from existing time_window JSON
--    time_window is stored as {"start":"HH:MM","end":"HH:MM"}
--    Start before 12:00 → morning, 12:00+ → night
UPDATE coverage_requirements
SET shift_type = CASE
  WHEN (time_window->>'start') >= '12:00' THEN 'night'
  ELSE 'morning'
END;

-- 3. stations: station-level minimum seniority
ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS min_seniority_level text;
