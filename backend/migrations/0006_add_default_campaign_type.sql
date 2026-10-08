-- ============================================================
-- Migration 0006: Add default value to campaign type column
--
-- Safe to run on existing databases.
-- (the calling campaigns table is "campaigns" before migration 0012
--  and "calling_campaigns" after it)
-- ============================================================

DO $$
DECLARE
    target text := CASE WHEN to_regclass('public.calling_campaigns') IS NOT NULL THEN 'calling_campaigns' ELSE 'campaigns' END;
BEGIN
    -- Ensure any existing NULL values in "type" column are set to 'outbound'
    EXECUTE format('UPDATE %I SET "type" = ''outbound'' WHERE "type" IS NULL', target);
    -- Set default value for "type" column to 'outbound'
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "type" SET DEFAULT ''outbound''', target);
END $$;
