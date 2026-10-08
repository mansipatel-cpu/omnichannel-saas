-- Final campaign consolidation.
-- `campaigns`, `campaign_recipients`, and `templates` become the only business
-- tables for WhatsApp and voice. Legacy channel tables are backed up, verified,
-- detached, and dropped in this transaction.

CREATE TABLE IF NOT EXISTS migration_0017_verification (
    metric text PRIMARY KEY,
    expected_count bigint NOT NULL,
    actual_count bigint NOT NULL,
    verified_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('public.calling_campaigns') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS migration_0017_calling_campaigns_backup
            (LIKE calling_campaigns INCLUDING ALL);
        INSERT INTO migration_0017_calling_campaigns_backup
        SELECT * FROM calling_campaigns ON CONFLICT (id) DO NOTHING;
    END IF;
    IF to_regclass('public.wa_campaigns') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS migration_0017_wa_campaigns_backup
            (LIKE wa_campaigns INCLUDING ALL);
        INSERT INTO migration_0017_wa_campaigns_backup
        SELECT * FROM wa_campaigns ON CONFLICT (id) DO NOTHING;
    END IF;
    IF to_regclass('public.campaign_contacts') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS migration_0017_campaign_contacts_backup
            (LIKE campaign_contacts INCLUDING ALL);
        INSERT INTO migration_0017_campaign_contacts_backup
        SELECT * FROM campaign_contacts ON CONFLICT (id) DO NOTHING;
    END IF;
    IF to_regclass('public.wa_campaign_recipients') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS migration_0017_wa_campaign_recipients_backup
            (LIKE wa_campaign_recipients INCLUDING ALL);
        INSERT INTO migration_0017_wa_campaign_recipients_backup
        SELECT * FROM wa_campaign_recipients ON CONFLICT (id) DO NOTHING;
    END IF;
    IF to_regclass('public.templates') IS NOT NULL THEN
        CREATE TABLE IF NOT EXISTS migration_0017_templates_backup
            (LIKE templates INCLUDING ALL);
        INSERT INTO migration_0017_templates_backup
        SELECT * FROM templates ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- A single UUID cannot represent two different source campaigns/recipients.
DO $$
DECLARE
    conflicts text;
BEGIN
    IF to_regclass('public.calling_campaigns') IS NOT NULL
       AND to_regclass('public.wa_campaigns') IS NOT NULL THEN
        SELECT string_agg(v.id, ', ' ORDER BY v.id) INTO conflicts
        FROM calling_campaigns v JOIN wa_campaigns w ON w.id = v.id;
        IF conflicts IS NOT NULL THEN
            RAISE EXCEPTION '0017 campaign id conflicts: %', conflicts;
        END IF;
    END IF;
    IF to_regclass('public.campaign_contacts') IS NOT NULL
       AND to_regclass('public.wa_campaign_recipients') IS NOT NULL THEN
        SELECT string_agg(v.id, ', ' ORDER BY v.id) INTO conflicts
        FROM campaign_contacts v JOIN wa_campaign_recipients w ON w.id = v.id;
        IF conflicts IS NOT NULL THEN
            RAISE EXCEPTION '0017 recipient id conflicts: %', conflicts;
        END IF;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Final templates table
-- ---------------------------------------------------------------------------
ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id varchar;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS channel_type varchar(20);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS provider_template_id text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE templates t
SET user_id = coalesce(
        account_owner_id(ch.created_by),
        account_owner_id(t.created_by),
        t.created_by,
        ch.created_by
    ),
    channel_type = coalesce(t.channel_type, 'whatsapp'),
    content = jsonb_strip_nulls(jsonb_build_object(
        'channelId', t.channel_id,
        'header', t.header,
        'body', t.body,
        'footer', t.footer,
        'buttons', coalesce(t.buttons, '[]'::jsonb),
        'variables', coalesce(t.variables, '[]'::jsonb),
        'mediaType', t.media_type,
        'mediaUrl', t.media_url,
        'mediaHandle', t.media_handle,
        'carouselCards', coalesce(t.carousel_cards, '[]'::jsonb),
        'headerType', t.header_type,
        'bodyVariables', t.body_variables
    )),
    provider_template_id = coalesce(t.provider_template_id, t.whatsapp_template_id),
    provider_status = coalesce(t.provider_status, t.status)
FROM channels ch
WHERE ch.id = t.channel_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM templates WHERE user_id IS NULL) THEN
        RAISE EXCEPTION '0017 cannot assign tenant to % template rows',
            (SELECT count(*) FROM templates WHERE user_id IS NULL);
    END IF;
END $$;

ALTER TABLE templates ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE templates ALTER COLUMN channel_type SET NOT NULL;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_channel_type_check;
ALTER TABLE templates ADD CONSTRAINT templates_channel_type_check
    CHECK (channel_type IN ('whatsapp', 'voice'));
CREATE INDEX IF NOT EXISTS templates_user_channel_idx
    ON templates (user_id, channel_type) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS templates_user_channel_name_active_unique
    ON templates (user_id, channel_type, name) WHERE deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'templates_user_id_users_id_fk'
    ) THEN
        ALTER TABLE templates ADD CONSTRAINT templates_user_id_users_id_fk
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Final campaigns table
-- ---------------------------------------------------------------------------
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel_type varchar(20);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS template_id varchar;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS group_id varchar;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS agent_id varchar;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS phone_number_id varchar;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS statistics jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE campaigns
SET channel_type = CASE channel WHEN 'calling' THEN 'voice' ELSE channel END
WHERE channel_type IS NULL;

CREATE OR REPLACE FUNCTION canonical_campaign_status(value text, is_deleted boolean DEFAULT false)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN is_deleted OR lower(coalesce(value, '')) = 'deleted' THEN 'deleted'
        WHEN lower(coalesce(value, '')) IN ('pending', 'draft') THEN 'draft'
        WHEN lower(value) = 'scheduled' THEN 'scheduled'
        WHEN lower(value) = 'queued' THEN 'queued'
        WHEN lower(coalesce(value, '')) IN ('active', 'sending', 'running', 'in-progress', 'in_progress') THEN 'running'
        WHEN lower(value) = 'paused' THEN 'paused'
        WHEN lower(value) = 'completed' THEN 'completed'
        WHEN lower(value) = 'failed' THEN 'failed'
        WHEN lower(coalesce(value, '')) IN ('cancelled', 'canceled', 'stopped') THEN 'cancelled'
        ELSE 'draft'
    END
$$;

DO $$
BEGIN
IF to_regclass('public.calling_campaigns') IS NOT NULL THEN
    UPDATE campaigns c
    SET user_id = v.user_id,
        name = v.name,
        description = coalesce(v.goal, c.description),
        channel_type = 'voice',
        campaign_type = coalesce(v.type, 'outbound'),
        status = canonical_campaign_status(v.status, v.deleted_at IS NOT NULL),
        agent_id = v.agent_id,
        phone_number_id = coalesce(v.phone_number_id, v.sip_phone_number_id, v.plivo_phone_number_id),
        scheduled_at = v.scheduled_for AT TIME ZONE 'UTC',
        started_at = v.started_at AT TIME ZONE 'UTC',
        completed_at = v.completed_at AT TIME ZONE 'UTC',
        timezone = coalesce(v.schedule_timezone, 'UTC'),
        retry_enabled = coalesce(v.retry_enabled, false),
        channel_config = jsonb_strip_nulls(coalesce(v.config, '{}'::jsonb) || jsonb_build_object(
            'voiceId', v.voice_id,
            'flowId', v.flow_id,
            'customScript', v.script,
            'sipPhoneNumberId', v.sip_phone_number_id,
            'plivoPhoneNumberId', v.plivo_phone_number_id,
            'batchJobId', v.batch_job_id,
            'batchJobStatus', v.batch_job_status,
            'schedule', CASE WHEN coalesce(v.schedule_enabled, false) THEN jsonb_build_object(
                'startTime', v.schedule_time_start,
                'endTime', v.schedule_time_end,
                'days', coalesce(to_jsonb(v.schedule_days), '[]'::jsonb),
                'timezone', v.schedule_timezone
            ) END,
            'retry', jsonb_build_object(
                'maxAttempts', v.retry_max_attempts,
                'intervalMinutes', v.retry_interval_minutes,
                'onNoAnswer', v.retry_on_no_answer,
                'onBusy', v.retry_on_busy,
                'onFailed', v.retry_on_failed,
                'currentPass', v.current_retry_pass,
                'history', coalesce(v.batch_job_history, '[]'::jsonb)
            )
        )),
        statistics = jsonb_build_object(
            'recipientCount', coalesce(v.total_contacts, 0),
            'completedCount', coalesce(v.completed_calls, 0),
            'successfulCount', coalesce(v.successful_calls, 0),
            'failedCount', coalesce(v.failed_calls, 0)
        ),
        created_by = coalesce(c.created_by, v.user_id),
        created_at = coalesce(v.created_at AT TIME ZONE 'UTC', c.created_at),
        updated_at = now(),
        deleted_at = v.deleted_at AT TIME ZONE 'UTC'
    FROM calling_campaigns v WHERE c.id = v.id;
END IF;

IF to_regclass('public.wa_campaigns') IS NOT NULL THEN
    UPDATE campaigns c
    SET name = w.name,
        description = w.description,
        channel_type = 'whatsapp',
        campaign_type = w.campaign_type,
        status = canonical_campaign_status(w.status, w.status = 'deleted'),
        template_id = w.template_id,
        scheduled_at = w.scheduled_at,
        started_at = w.population_started_at,
        completed_at = w.completed_at,
        timezone = coalesce(c.timezone, 'UTC'),
        retry_enabled = coalesce((to_jsonb(w)->>'auto_retry')::boolean, false),
        channel_config = jsonb_strip_nulls(jsonb_build_object(
            'channelId', w.channel_id,
            'language', w.template_language,
            'templateVariables', coalesce(w.variable_mapping, '{}'::jsonb),
            'templateName', w.template_name,
            'apiType', w.api_type,
            'audienceType', w.audience_type,
            'platform', w.platform,
            'contactIds', coalesce(w.contact_groups, '[]'::jsonb),
            'csvData', coalesce(w.csv_data, '[]'::jsonb),
            'apiKey', w.api_key,
            'apiEndpoint', w.api_endpoint
        )),
        statistics = jsonb_build_object(
            'recipientCount', coalesce(w.recipient_count, 0),
            'sentCount', coalesce(w.sent_count, 0),
            'deliveredCount', coalesce(w.delivered_count, 0),
            'readCount', coalesce(w.read_count, 0),
            'repliedCount', coalesce(w.replied_count, 0),
            'failedCount', coalesce(w.failed_count, 0)
        ),
        created_by = w.created_by,
        created_at = coalesce(w.created_at, c.created_at),
        updated_at = coalesce(w.updated_at, now()),
        deleted_at = CASE WHEN w.status = 'deleted'
            THEN coalesce(c.deleted_at, w.updated_at, now()) ELSE NULL END
    FROM wa_campaigns w WHERE c.id = w.id;
END IF;
END $$;

UPDATE campaigns
SET status = canonical_campaign_status(status, deleted_at IS NOT NULL),
    channel_type = CASE channel_type WHEN 'calling' THEN 'voice' ELSE channel_type END;

ALTER TABLE campaigns ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE campaigns ALTER COLUMN channel_type SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN status SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_check;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_type_check;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_channel_type_check
    CHECK (channel_type IN ('whatsapp', 'voice'));
ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft','scheduled','queued','running','paused','completed','failed','cancelled','deleted'));

CREATE INDEX IF NOT EXISTS campaigns_user_channel_type_idx
    ON campaigns (user_id, channel_type);
CREATE INDEX IF NOT EXISTS campaigns_user_status_active_idx
    ON campaigns (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS campaigns_scheduled_active_idx
    ON campaigns (scheduled_at) WHERE deleted_at IS NULL AND status = 'scheduled';
CREATE INDEX IF NOT EXISTS campaigns_template_idx ON campaigns (template_id);
CREATE INDEX IF NOT EXISTS campaigns_created_by_idx ON campaigns (created_by);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_template_id_templates_id_fk') THEN
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_template_id_templates_id_fk
            FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_group_id_contact_groups_id_fk') THEN
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_group_id_contact_groups_id_fk
            FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Final campaign recipients table
-- ---------------------------------------------------------------------------
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS provider_reference text;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS variables jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION canonical_recipient_status(value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN lower(coalesce(value, '')) IN ('pending', 'new') THEN 'pending'
        WHEN lower(value) IN ('queued', 'scheduled') THEN 'queued'
        WHEN lower(value) IN ('processing', 'initiated', 'ringing', 'in-progress', 'in_progress') THEN 'processing'
        WHEN lower(value) = 'sent' THEN 'sent'
        WHEN lower(value) = 'delivered' THEN 'delivered'
        WHEN lower(value) = 'read' THEN 'read'
        WHEN lower(value) IN ('answered', 'connected') THEN 'answered'
        WHEN lower(value) IN ('completed', 'done', 'success') THEN 'completed'
        WHEN lower(value) IN ('skipped', 'invalid') THEN 'skipped'
        WHEN lower(value) IN ('cancelled', 'canceled') THEN 'cancelled'
        WHEN lower(value) IN ('failed', 'busy', 'no-answer', 'no_answer') THEN 'failed'
        ELSE 'pending'
    END
$$;

DO $$
BEGIN
IF to_regclass('public.campaign_contacts') IS NOT NULL THEN
    UPDATE campaign_recipients r
    SET contact_id = v.contact_id,
        phone = v.phone,
        name = nullif(btrim(concat_ws(' ', v.first_name, v.last_name)), ''),
        email = v.email,
        status = canonical_recipient_status(v.status),
        attempt_count = coalesce(v.attempt_count, 0),
        variables = coalesce(v.custom_fields, '{}'::jsonb),
        result = jsonb_strip_nulls(jsonb_build_object(
            'lastAttemptAt', v.last_attempt_at,
            'nextRetryAt', v.next_retry_at
        )),
        created_at = coalesce(v.created_at AT TIME ZONE 'UTC', r.created_at),
        updated_at = now()
    FROM campaign_contacts v WHERE r.id = v.id;
END IF;

IF to_regclass('public.wa_campaign_recipients') IS NOT NULL THEN
    UPDATE campaign_recipients r
    SET phone = w.phone,
        name = w.name,
        status = canonical_recipient_status(w.status),
        attempt_count = coalesce(w.retry_count, 0) +
            CASE WHEN coalesce(w.status, 'pending') = 'pending' THEN 0 ELSE 1 END,
        provider_reference = w.whatsapp_message_id,
        sent_at = w.sent_at,
        delivered_at = w.delivered_at,
        read_at = w.read_at,
        error_code = w.error_code,
        error_message = w.error_message,
        variables = coalesce(w.template_params, '{}'::jsonb),
        result = jsonb_strip_nulls(jsonb_build_object('whatsappMessageId', w.whatsapp_message_id)),
        created_at = coalesce(w.created_at, r.created_at),
        updated_at = coalesce(w.updated_at, now())
    FROM wa_campaign_recipients w WHERE r.id = w.id;
END IF;
END $$;

UPDATE campaign_recipients SET status = canonical_recipient_status(status);
ALTER TABLE campaign_recipients ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE campaign_recipients ALTER COLUMN status SET NOT NULL;
ALTER TABLE campaign_recipients ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_channel_check;
ALTER TABLE campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_status_check;
ALTER TABLE campaign_recipients ADD CONSTRAINT campaign_recipients_status_check
    CHECK (status IN ('pending','queued','processing','sent','delivered','read','answered','completed','failed','skipped','cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_campaign_phone_unique
    ON campaign_recipients (campaign_id, phone);
CREATE INDEX IF NOT EXISTS campaign_recipients_provider_reference_idx
    ON campaign_recipients (provider_reference) WHERE provider_reference IS NOT NULL;

-- Verification is performed before any destructive operation.
INSERT INTO migration_0017_verification(metric, expected_count, actual_count)
SELECT 'campaigns.voice',
       (SELECT count(*) FROM migration_0017_calling_campaigns_backup),
       (SELECT count(*) FROM campaigns WHERE channel_type = 'voice')
WHERE to_regclass('public.migration_0017_calling_campaigns_backup') IS NOT NULL
ON CONFLICT (metric) DO UPDATE SET expected_count = EXCLUDED.expected_count,
    actual_count = EXCLUDED.actual_count, verified_at = now();

INSERT INTO migration_0017_verification(metric, expected_count, actual_count)
SELECT 'campaigns.whatsapp',
       (SELECT count(*) FROM migration_0017_wa_campaigns_backup),
       (SELECT count(*) FROM campaigns WHERE channel_type = 'whatsapp')
WHERE to_regclass('public.migration_0017_wa_campaigns_backup') IS NOT NULL
ON CONFLICT (metric) DO UPDATE SET expected_count = EXCLUDED.expected_count,
    actual_count = EXCLUDED.actual_count, verified_at = now();

INSERT INTO migration_0017_verification(metric, expected_count, actual_count)
SELECT 'recipients.total',
       coalesce((SELECT count(*) FROM migration_0017_campaign_contacts_backup), 0) +
       coalesce((SELECT count(*) FROM migration_0017_wa_campaign_recipients_backup), 0),
       (SELECT count(*) FROM campaign_recipients)
ON CONFLICT (metric) DO UPDATE SET expected_count = EXCLUDED.expected_count,
    actual_count = EXCLUDED.actual_count, verified_at = now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM migration_0017_verification
        WHERE expected_count <> actual_count
    ) THEN
        RAISE EXCEPTION '0017 row-count verification failed: %',
            (SELECT string_agg(metric || '=' || actual_count || '/' || expected_count, ', ')
             FROM migration_0017_verification WHERE expected_count <> actual_count);
    END IF;
    IF EXISTS (
        SELECT 1 FROM campaign_recipients r
        LEFT JOIN campaigns c ON c.id = r.campaign_id
        WHERE c.id IS NULL
    ) THEN
        RAISE EXCEPTION '0017 found orphan campaign recipients';
    END IF;
END $$;

-- Re-point every existing single-column FK from legacy campaign/recipient
-- tables before those tables are removed.
DO $$
DECLARE
    fk record;
    target_table text;
    delete_action text;
BEGIN
    FOR fk IN
        SELECT c.oid, c.conname, c.conrelid::regclass AS source_table,
               a.attname AS source_column, a.attnotnull,
               c.confrelid::regclass::text AS referenced_table
        FROM pg_constraint c
        JOIN unnest(c.conkey) WITH ORDINALITY key(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
        WHERE c.contype = 'f'
          AND cardinality(c.conkey) = 1
          AND c.confrelid IN (
              coalesce(to_regclass('public.calling_campaigns'), 0::oid),
              coalesce(to_regclass('public.wa_campaigns'), 0::oid),
              coalesce(to_regclass('public.campaign_contacts'), 0::oid),
              coalesce(to_regclass('public.wa_campaign_recipients'), 0::oid)
          )
    LOOP
        target_table := CASE
            WHEN fk.referenced_table IN ('calling_campaigns', 'wa_campaigns') THEN 'campaigns'
            ELSE 'campaign_recipients'
        END;
        delete_action := CASE WHEN fk.attnotnull THEN 'CASCADE' ELSE 'SET NULL' END;
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.source_table, fk.conname);
        EXECUTE format(
            'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s',
            fk.source_table, fk.conname, fk.source_column, target_table, delete_action
        );
    END LOOP;
END $$;

DO $$
BEGIN
    IF to_regclass('public.calling_campaigns') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS calling_campaigns_sync ON calling_campaigns;
    END IF;
    IF to_regclass('public.wa_campaigns') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS wa_campaigns_sync ON wa_campaigns;
    END IF;
    IF to_regclass('public.campaign_contacts') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS campaign_contacts_link_contact ON campaign_contacts;
        DROP TRIGGER IF EXISTS campaign_contacts_sync ON campaign_contacts;
    END IF;
    IF to_regclass('public.wa_campaign_recipients') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS wa_campaign_recipients_sync ON wa_campaign_recipients;
    END IF;
END $$;

DROP FUNCTION IF EXISTS sync_calling_campaign();
DROP FUNCTION IF EXISTS sync_wa_campaign();
DROP FUNCTION IF EXISTS link_calling_recipient_contact();
DROP FUNCTION IF EXISTS sync_calling_recipient();
DROP FUNCTION IF EXISTS sync_wa_recipient();

DROP TABLE IF EXISTS campaign_contacts;
DROP TABLE IF EXISTS wa_campaign_recipients;
DROP TABLE IF EXISTS calling_campaigns;
DROP TABLE IF EXISTS wa_campaigns;

ALTER TABLE campaigns DROP COLUMN IF EXISTS channel;
ALTER TABLE campaigns DROP COLUMN IF EXISTS recipient_count;
ALTER TABLE campaign_recipients DROP COLUMN IF EXISTS channel;
ALTER TABLE campaign_recipients DROP COLUMN IF EXISTS last_attempt_at;
ALTER TABLE campaign_recipients DROP COLUMN IF EXISTS next_retry_at;
ALTER TABLE campaign_recipients DROP COLUMN IF EXISTS error;

ALTER TABLE templates DROP COLUMN IF EXISTS channel_id CASCADE;
ALTER TABLE templates DROP COLUMN IF EXISTS header;
ALTER TABLE templates DROP COLUMN IF EXISTS body;
ALTER TABLE templates DROP COLUMN IF EXISTS footer;
ALTER TABLE templates DROP COLUMN IF EXISTS buttons;
ALTER TABLE templates DROP COLUMN IF EXISTS variables;
ALTER TABLE templates DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE templates DROP COLUMN IF EXISTS media_type;
ALTER TABLE templates DROP COLUMN IF EXISTS media_url;
ALTER TABLE templates DROP COLUMN IF EXISTS media_handle;
ALTER TABLE templates DROP COLUMN IF EXISTS carousel_cards;
ALTER TABLE templates DROP COLUMN IF EXISTS whatsapp_template_id CASCADE;
ALTER TABLE templates DROP COLUMN IF EXISTS usage_count;
ALTER TABLE templates DROP COLUMN IF EXISTS header_type;
ALTER TABLE templates DROP COLUMN IF EXISTS body_variables;

DROP FUNCTION IF EXISTS canonical_campaign_status(text, boolean);
DROP FUNCTION IF EXISTS canonical_recipient_status(text);
