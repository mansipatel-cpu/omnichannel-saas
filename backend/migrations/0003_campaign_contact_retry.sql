-- ============================================================
-- Migration 0003: Campaign contact retry system
--
-- Adds retry configuration columns to campaigns table and
-- attempt-tracking columns to contacts table.
--
-- SAFE TO RUN ON EXISTING DATABASES: uses ADD COLUMN IF NOT EXISTS
-- IDEMPOTENT: running this migration multiple times will not error
-- ============================================================

-- calling campaigns: retry configuration columns
-- (the table is "campaigns" before migration 0012 and "calling_campaigns" after it)
DO $$
DECLARE
    target text := CASE WHEN to_regclass('public.calling_campaigns') IS NOT NULL THEN 'calling_campaigns' ELSE 'campaigns' END;
BEGIN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "retry_max_attempts" integer DEFAULT 3', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "retry_interval_minutes" integer DEFAULT 60', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "retry_on_no_answer" boolean DEFAULT true', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "retry_on_busy" boolean DEFAULT false', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "retry_on_failed" boolean DEFAULT false', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "batch_job_history" jsonb DEFAULT ''[]''::jsonb', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "current_retry_pass" integer DEFAULT 0', target);
END $$;

-- calling campaign contacts: attempt tracking columns
-- (the table is "contacts" before migration 0011 and "campaign_contacts" after it)
DO $$
DECLARE
    target text := CASE WHEN to_regclass('public.campaign_contacts') IS NOT NULL THEN 'campaign_contacts' ELSE 'contacts' END;
BEGIN
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 1', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp', target);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp', target);
END $$;
