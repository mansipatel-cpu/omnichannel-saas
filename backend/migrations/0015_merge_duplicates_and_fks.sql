-- Stage 4b of the unified schema: merge true duplicate tables and add the
-- foreign keys that were missing.
--
--   wa_otp_verifications -> merged into otp_verifications (email OTPs for signup,
--                           user OTPs for WhatsApp verification / password reset)
--   whatsapp_channels    -> merged into channels (the table every channel flow
--                           already writes; whatsapp_channels was only read)
--
-- Kept separate on purpose (different features, not duplicates):
--   notifications vs wa_notifications (inbox vs broadcast), api_keys vs WhatsApp
--   client keys (different key formats), webhook_configs (inbound) vs
--   webhook_subscriptions (outbound), knowledge_base vs training_* (different RAG
--   pipelines).
--
-- Foreign keys are added NOT VALID first and validated only when no orphan rows
-- exist, so old dangling data never blocks the migration. Columns deliberately
-- left without a FK: calling_campaigns.agent_id / calls.agent_id (any agent
-- kind), flows.user_id ('system' templates), wa_notifications.created_by
-- ('system'), support ticket people (users or admin/listener tables),
-- sites/training channel_id (point at deleted channels today), polymorphic
-- *call_id columns, and phone_release_retry_queue.user_id (must outlive the user).
--
-- Idempotent: run-safe-migration.mjs re-applies every file on each run.

-- ---------------------------------------------------------------------------
-- 1. OTP verifications
-- ---------------------------------------------------------------------------
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS user_id varchar;
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
ALTER TABLE otp_verifications ALTER COLUMN email DROP NOT NULL;
CREATE INDEX IF NOT EXISTS otp_verifications_email_idx ON otp_verifications (email);
CREATE INDEX IF NOT EXISTS otp_verifications_user_id_idx ON otp_verifications (user_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'otp_verifications_email_or_user_check') THEN
        ALTER TABLE otp_verifications
            ADD CONSTRAINT otp_verifications_email_or_user_check CHECK (email IS NOT NULL OR user_id IS NOT NULL);
    END IF;

    IF to_regclass('public.wa_otp_verifications') IS NOT NULL THEN
        INSERT INTO otp_verifications (id, email, user_id, otp_code, expires_at, attempts, verified, created_at, updated_at)
        SELECT w.id, NULL, w.user_id, w.otp_code, w.expires_at AT TIME ZONE 'UTC', 0, coalesce(w.is_used, false),
               coalesce(w.created_at, now()) AT TIME ZONE 'UTC', coalesce(w.updated_at, now()) AT TIME ZONE 'UTC'
        FROM wa_otp_verifications w
        WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = w.user_id)
        ON CONFLICT (id) DO NOTHING;
        DROP TABLE wa_otp_verifications;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. WhatsApp channels
-- ---------------------------------------------------------------------------
ALTER TABLE channels ALTER COLUMN created_by SET DEFAULT NULL;
UPDATE channels SET created_by = NULL WHERE created_by = '';

DO $$
BEGIN
    IF to_regclass('public.whatsapp_channels') IS NOT NULL THEN
        INSERT INTO channels (id, name, phone_number_id, access_token, whatsapp_business_account_id, phone_number,
                              is_active, health_status, last_health_check, connection_method, created_at, updated_at, created_by)
        SELECT w.id, w.name, w.phone_number_id, w.access_token, coalesce(w.waba_id, w.business_account_id), w.phone_number,
               coalesce(w.status = 'active', false), CASE WHEN w.status = 'error' THEN 'error' ELSE 'unknown' END,
               w.last_health_check, 'manual', w.created_at, w.updated_at, NULL
        FROM whatsapp_channels w
        WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.id = w.id OR c.phone_number_id = w.phone_number_id);
        DROP TABLE whatsapp_channels;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Missing foreign keys
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    spec    text[];
    cname   text;
    orphans bigint;
BEGIN
    FOREACH spec SLICE 1 IN ARRAY ARRAY[
        -- table, column, referenced table, on delete
        ARRAY['otp_verifications',             'user_id',                   'users',                   'cascade'],
        ARRAY['users',                         'created_by',                'users',                   'set null'],
        ARRAY['users',                         'eleven_labs_credential_id', 'eleven_labs_credentials', 'set null'],
        ARRAY['agents',                        'flow_id',                   'flows',                   'set null'],
        ARRAY['agents',                        'openai_credential_id',      'openai_credentials',      'set null'],
        ARRAY['agents',                        'sip_phone_number_id',       'sip_phone_numbers',       'set null'],
        ARRAY['agents',                        'sip_trunk_id',              'sip_trunks',              'set null'],
        ARRAY['calling_campaigns',             'flow_id',                   'flows',                   'set null'],
        ARRAY['calling_campaigns',             'plivo_phone_number_id',     'plivo_phone_numbers',     'set null'],
        ARRAY['calling_campaigns',             'sip_phone_number_id',       'sip_phone_numbers',       'set null'],
        ARRAY['calls',                         'widget_id',                 'website_widgets',         'set null'],
        ARRAY['credit_transactions',           'widget_id',                 'website_widgets',         'set null'],
        ARRAY['campaign_jobs',                 'campaign_id',               'calling_campaigns',       'cascade'],
        ARRAY['campaign_jobs',                 'contact_id',                'campaign_contacts',       'cascade'],
        ARRAY['flows',                         'agent_id',                  'agents',                  'set null'],
        ARRAY['flow_test_queue',               'user_id',                   'users',                   'cascade'],
        ARRAY['webhook_subscriptions',         'user_id',                   'users',                   'cascade'],
        ARRAY['appointments',                  'user_id',                   'users',                   'cascade'],
        ARRAY['appointment_settings',          'user_id',                   'users',                   'cascade'],
        ARRAY['forms',                         'user_id',                   'users',                   'cascade'],
        ARRAY['google_calendar_credentials',   'user_id',                   'users',                   'cascade'],
        ARRAY['google_sheets_credentials',     'user_id',                   'users',                   'cascade'],
        ARRAY['widget_call_sessions',          'openai_credential_id',      'openai_credentials',      'set null'],
        ARRAY['website_widgets',               'agent_id',                  'agents',                  'set null'],
        ARRAY['channels',                      'created_by',                'users',                   'set null'],
        ARRAY['abandoned_carts',               'channel_id',                'channels',                'cascade'],
        ARRAY['analytics',                     'channel_id',                'channels',                'cascade'],
        ARRAY['channel_signup_logs',           'user_id',                   'users',                   'cascade'],
        ARRAY['channel_signup_logs',           'channel_id',                'channels',                'set null'],
        ARRAY['conversations',                 'chatbot_id',                'chatbots',                'set null'],
        ARRAY['sent_notifications',            'user_id',                   'users',                   'cascade'],
        ARRAY['user_notification_preferences', 'user_id',                   'users',                   'cascade'],
        ARRAY['knowledge_categories',          'parent_id',                 'knowledge_categories',    'set null'],
        ARRAY['knowledge_articles',            'category_id',               'knowledge_categories',    'cascade'],
        ARRAY['ai_settings',                   'site_id',                   'sites',                   'cascade'],
        ARRAY['training_sources',              'site_id',                   'sites',                   'cascade'],
        ARRAY['training_chunks',               'site_id',                   'sites',                   'cascade'],
        ARRAY['training_qa_pairs',             'site_id',                   'sites',                   'cascade']
    ] LOOP
        IF to_regclass('public.' || spec[1]) IS NULL OR to_regclass('public.' || spec[3]) IS NULL
           OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_schema = 'public' AND table_name = spec[1] AND column_name = spec[2]) THEN
            RAISE NOTICE 'FK skipped, % .% or % missing', spec[1], spec[2], spec[3];
            CONTINUE;
        END IF;
        -- Same name drizzle-kit generates, so db:push sees the constraint as its own.
        cname := left(spec[1] || '_' || spec[2] || '_' || spec[3] || '_id_fk', 63);
        IF EXISTS (SELECT 1 FROM pg_constraint c
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
                   WHERE c.contype = 'f' AND c.conrelid = ('public.' || spec[1])::regclass AND a.attname = spec[2]) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s NOT VALID',
            spec[1], cname, spec[2], spec[3], spec[4]);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%I)', left(spec[1] || '_' || spec[2] || '_fk_idx', 63), spec[1], spec[2]);
    END LOOP;

    -- Validate every NOT VALID FK that has no orphan rows (covers earlier runs too).
    FOR spec IN
        SELECT ARRAY[cl.relname::text, c.conname::text, a.attname::text, rt.relname::text]
        FROM pg_constraint c
        JOIN pg_class cl ON cl.oid = c.conrelid
        JOIN pg_class rt ON rt.oid = c.confrelid
        JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1] AND ra.attname = 'id'
        WHERE c.contype = 'f' AND NOT c.convalidated AND array_length(c.conkey, 1) = 1
    LOOP
        EXECUTE format('SELECT count(*) FROM %I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I r WHERE r.id = t.%I)',
            spec[1], spec[3], spec[4], spec[3]) INTO orphans;
        IF orphans = 0 THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', spec[1], spec[2]);
        ELSE
            RAISE NOTICE 'FK % left NOT VALID: % orphan rows in %.%', spec[2], orphans, spec[1], spec[3];
        END IF;
    END LOOP;
END $$;
